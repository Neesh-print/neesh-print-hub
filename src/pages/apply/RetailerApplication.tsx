import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ButtonPrimary, FormInput, FormSelect, Logo } from "@/components/neesh";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizeWeb } from "@/lib/normalize-web";
import { toast } from "sonner";

const STORAGE_KEY = "neesh_retailer_application_draft";
const TOTAL_STEPS = 2;

const COUNTRIES = [
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Canada", label: "Canada" },
  { value: "Germany", label: "Germany" },
  { value: "France", label: "France" },
  { value: "Australia", label: "Australia" },
  { value: "Netherlands", label: "Netherlands" },
  { value: "Other", label: "Other" },
];

// Mirrors the DB-side validate_retailer_application trigger
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  storeName: string;
  city: string;
  state: string;
  country: string;
  websiteUrl: string;
  optInUpdates: boolean;
}

// Fields restored from the localStorage draft — the password is deliberately
// never saved or restored.
const FORM_FIELDS: (keyof FormData)[] = [
  "firstName", "lastName", "email", "storeName",
  "city", "state", "country", "websiteUrl", "optInUpdates",
];

const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
  1: ["firstName", "lastName", "email", "password", "storeName"],
  2: ["city", "state", "country", "websiteUrl"],
};

export const RetailerApplication = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, watch, setValue, setError, setFocus, trigger, getFieldState, formState: { errors }, getValues } = useForm<FormData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      storeName: "",
      city: "",
      state: "",
      country: "",
      websiteUrl: "",
      optInUpdates: true,
    },
    mode: "onChange",
  });

  const watchedValues = watch();

  // Load saved data from localStorage (clear if stale > 7 days)
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Clear stale drafts older than 7 days
        if (parsed._savedAt && Date.now() - parsed._savedAt > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        Object.entries(parsed).forEach(([key, value]) => {
          if (!FORM_FIELDS.includes(key as keyof FormData)) return;
          setValue(key as keyof FormData, value as string | boolean);
        });
        if (parsed.currentStep === 2) {
          setCurrentStep(2);
        }
      } catch (e) {
        console.error("Failed to parse saved application data");
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [setValue]);

  // Save data to localStorage on change (only while filling out the form).
  // The password never touches localStorage.
  useEffect(() => {
    if (currentStep > TOTAL_STEPS) return;
    const { password: _password, ...safeValues } = watchedValues;
    const dataToSave = { ...safeValues, currentStep, _savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [watchedValues, currentStep]);

  const progress = currentStep === 1 ? 50 : 100;

  const handleBack = useCallback(() => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  }, [currentStep]);

  // Scroll to and focus the first invalid field so a failed submit is never silent
  const focusFirstError = useCallback((step: number) => {
    const firstInvalid = STEP_FIELDS[step]?.find((name) => getFieldState(name).invalid);
    if (firstInvalid) {
      setFocus(firstInvalid);
      requestAnimationFrame(() => {
        document.activeElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [getFieldState, setFocus]);

  const validateStep = useCallback(async (step: number): Promise<boolean> => {
    const isValid = await trigger(STEP_FIELDS[step]);
    if (!isValid) focusFirstError(step);
    return isValid;
  }, [trigger, focusFirstError]);

  const handleContinue = useCallback(async () => {
    if (await validateStep(1)) {
      setCurrentStep(2);
      window.scrollTo({ top: 0 });
    }
  }, [validateStep]);

  const handleSubmit = useCallback(async () => {
    if (!(await validateStep(2))) return;

    setIsSubmitting(true);
    try {
      const values = getValues();

      const { error } = await supabase.functions.invoke("signup-retailer", {
        body: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          password: values.password,
          storeName: values.storeName.trim(),
          city: values.city.trim(),
          state: values.state.trim(),
          country: values.country,
          website: normalizeWeb(values.websiteUrl),
          optInUpdates: values.optInUpdates,
          redirectUrl: window.location.origin,
        },
      });

      if (error) {
        // A 409 means this email already has a Neesh account
        let isExistingAccount = false;
        if ("context" in error && error.context instanceof Response) {
          isExistingAccount = error.context.status === 409;
        }
        if (isExistingAccount) {
          setCurrentStep(1);
          setError("email", {
            type: "manual",
            message: "An account with this email already exists. Try logging in instead.",
          });
          requestAnimationFrame(() => setFocus("email"));
          return;
        }
        throw error;
      }

      // Clear localStorage on successful signup
      localStorage.removeItem(STORAGE_KEY);

      // Sign straight in — the catalog should be one click away. If this
      // somehow fails, the confirmation screen's CTA lands on the login page
      // via ProtectedRoute, so the account is still usable.
      const { error: signInError } = await signIn(values.email.trim(), values.password);
      if (signInError) {
        console.error("Auto sign-in after signup failed:", signInError);
      }

      setCurrentStep(3);
      window.scrollTo({ top: 0 });
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error("Something went wrong creating your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [validateStep, getValues, setError, setFocus, signIn]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Enter" || isSubmitting) return;
    if (currentStep === 1) {
      e.preventDefault();
      handleContinue();
    } else if (currentStep === 2) {
      e.preventDefault();
      handleSubmit();
    }
  }, [currentStep, isSubmitting, handleContinue, handleSubmit]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-2">
              Let's get your store on Neesh
            </h1>
            <p className="text-body text-muted-foreground mb-8">
              This takes about 30 seconds.
            </p>
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  name="firstName"
                  control={control}
                  rules={{
                    required: "Add your first name.",
                    maxLength: { value: 99, message: "First name must be under 100 characters." },
                  }}
                  render={({ field }) => (
                    <FormInput
                      id="firstName"
                      label="First Name"
                      placeholder="Your first name"
                      autoComplete="given-name"
                      error={errors.firstName?.message}
                      {...field}
                    />
                  )}
                />
                <Controller
                  name="lastName"
                  control={control}
                  rules={{
                    required: "Add your last name.",
                    maxLength: { value: 99, message: "Last name must be under 100 characters." },
                  }}
                  render={({ field }) => (
                    <FormInput
                      id="lastName"
                      label="Last Name"
                      placeholder="Your last name"
                      autoComplete="family-name"
                      error={errors.lastName?.message}
                      {...field}
                    />
                  )}
                />
              </div>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: "That email address doesn't look right.",
                  pattern: {
                    value: EMAIL_REGEX,
                    message: "That email address doesn't look right.",
                  },
                  maxLength: { value: 255, message: "Email must be 255 characters or fewer." },
                }}
                render={({ field }) => (
                  <FormInput
                    id="email"
                    label="Email Address"
                    type="email"
                    placeholder="you@yourstore.com"
                    autoComplete="email"
                    helperText="We send order confirmations here."
                    error={errors.email?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="password"
                control={control}
                rules={{
                  required: "Create a password with at least 8 characters.",
                  minLength: { value: 8, message: "Password must be at least 8 characters." },
                  maxLength: { value: 72, message: "Password must be 72 characters or fewer." },
                }}
                render={({ field }) => (
                  <FormInput
                    id="password"
                    label="Password"
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    helperText="You'll be signed in as soon as you create your account."
                    error={errors.password?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="storeName"
                control={control}
                rules={{
                  required: "Add the name of your store.",
                  maxLength: { value: 200, message: "Store name must be 200 characters or fewer." },
                }}
                render={({ field }) => (
                  <FormInput
                    id="storeName"
                    label="Store Name"
                    placeholder="e.g., McNally Jackson, Arcana Books, Café Integral"
                    autoComplete="organization"
                    error={errors.storeName?.message}
                    {...field}
                  />
                )}
              />
            </div>
            <ButtonPrimary onClick={handleContinue} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 2:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-2">
              Where can we find your store?
            </h1>
            <p className="text-body text-muted-foreground mb-8">
              We use this to verify your store.
            </p>
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  name="city"
                  control={control}
                  rules={{ required: "Add the city your store is in." }}
                  render={({ field }) => (
                    <FormInput
                      id="city"
                      label="City"
                      placeholder="e.g., New York, London, Berlin"
                      autoComplete="address-level2"
                      error={errors.city?.message}
                      {...field}
                    />
                  )}
                />
                <Controller
                  name="state"
                  control={control}
                  rules={{ required: "Add a state, region, or province." }}
                  render={({ field }) => (
                    <FormInput
                      id="state"
                      label="State / Region / Province"
                      placeholder="e.g., New York, England, Bavaria"
                      autoComplete="address-level1"
                      error={errors.state?.message}
                      {...field}
                    />
                  )}
                />
              </div>
              <Controller
                name="country"
                control={control}
                rules={{ required: "Choose a country." }}
                render={({ field }) => (
                  <FormSelect
                    id="country"
                    label="Country"
                    options={COUNTRIES}
                    placeholder="Select a country"
                    error={errors.country?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="websiteUrl"
                control={control}
                rules={{ required: "Add a website or an Instagram link." }}
                render={({ field }) => (
                  <FormInput
                    id="websiteUrl"
                    label="Website"
                    placeholder="yourstore.com"
                    helperText="An Instagram link works too, if that's where your store lives."
                    error={errors.websiteUrl?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="optInUpdates"
                control={control}
                render={({ field }) => (
                  <label className="flex items-start gap-3 cursor-pointer pt-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                    <span className="text-body text-muted-foreground">
                      I'd like to receive platform updates and retailer insights
                    </span>
                  </label>
                )}
              />
            </div>
            <ButtonPrimary onClick={handleSubmit} fullWidth loading={isSubmitting}>
              {isSubmitting ? "Creating your account..." : "Create account"}
            </ButtonPrimary>
          </div>
        );

      case 3:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
              You're in.
            </h1>
            <p className="text-body text-muted-foreground mb-8">
              You're signed in and the catalog is open. We've sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{getValues("email")}</span> —
              click it before placing your first order.
            </p>
            <ButtonPrimary onClick={() => navigate("/retailer")} fullWidth>
              Browse the catalog
            </ButtonPrimary>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background">
        <div className="flex items-center justify-between px-6 md:px-8 py-4">
          {/* Logo */}
          <a
            href="/"
            className="hover:opacity-80 transition-opacity"
          >
            <Logo size="lg" />
          </a>

          {/* Progress indicator */}
          <span className="text-sm text-muted-foreground">
            {currentStep <= TOTAL_STEPS ? `Step ${currentStep} of ${TOTAL_STEPS}` : "Done"}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Back button - positioned below header */}
      {currentStep === 2 && (
        <div className="fixed top-20 left-6 md:left-8 z-40">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 md:px-6 pt-20 pb-8">
        <div className="w-full max-w-md">
          <div key={currentStep}>
            {renderStep()}
          </div>
        </div>
      </main>
    </div>
  );
};
