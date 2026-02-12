import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ButtonPrimary, ButtonSecondary, FormInput, FormSelect, Logo } from "@/components/neesh";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const STORAGE_KEY = "neesh_retailer_application_draft";
const TOTAL_STEPS = 9;

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

const STORE_CATEGORIES = [
  { id: "independent_bookstore", label: "Independent Bookstore" },
  { id: "museum_shop", label: "Museum Shop" },
  { id: "art_gallery", label: "Art Gallery" },
  { id: "gift_shop", label: "Gift Shop" },
  { id: "university_bookstore", label: "University Bookstore" },
  { id: "boutique_fashion", label: "Boutique/Fashion" },
  { id: "coffee_shop_cafe", label: "Coffee Shop/Café" },
  { id: "hotel_lobby", label: "Hotel/Lobby Shop" },
  { id: "lifestyle_store", label: "Lifestyle Store" },
  { id: "other", label: "Other" },
];

const STORE_TYPES = [
  { value: "independent", label: "Independent" },
  { value: "small_chain", label: "Small Chain (2-5)" },
  { value: "regional_chain", label: "Regional Chain (6-20)" },
  { value: "national_chain", label: "National Chain (20+)" },
];

const STORE_SIZES = [
  { value: "small", label: "Small (<1,000 sq ft)" },
  { value: "medium", label: "Medium (1,000-3,000 sq ft)" },
  { value: "large", label: "Large (>3,000 sq ft)" },
];

const YEARS_IN_BUSINESS = [
  { value: "less_than_1", label: "Less than 1 year" },
  { value: "1_to_3", label: "1-3 years" },
  { value: "3_to_10", label: "3-10 years" },
  { value: "10_plus", label: "10+ years" },
];

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  storeName: string;
  storeCategory: string;
  customCategory: string;
  city: string;
  state: string;
  country: string;
  websiteUrl: string;
  instagramHandle: string;
  storeType: string;
  storeSize: string;
  yearsInBusiness: string;
  confirmAccuracy: boolean;
  optInUpdates: boolean;
}

export const RetailerApplication = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { control, watch, setValue, trigger, formState: { errors }, getValues } = useForm<FormData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      storeName: "",
      storeCategory: "",
      customCategory: "",
      city: "",
      state: "",
      country: "",
      websiteUrl: "",
      instagramHandle: "",
      storeType: "",
      storeSize: "",
      yearsInBusiness: "",
      confirmAccuracy: false,
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
          if (key === "currentStep" || key === "_savedAt") return;
          setValue(key as keyof FormData, value as string | boolean);
        });
        if (parsed.currentStep) {
          setCurrentStep(parsed.currentStep);
        }
      } catch (e) {
        console.error("Failed to parse saved application data");
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [setValue]);

  // Save data to localStorage on change
  useEffect(() => {
    const dataToSave = { ...watchedValues, currentStep, _savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [watchedValues, currentStep]);

  const progress = Math.round((currentStep / TOTAL_STEPS) * 100);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigate("/apply");
    }
  }, [currentStep, navigate]);

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 2: {
        const contactValid = await trigger(["firstName", "lastName", "email", "phone"]);
        if (!watchedValues.firstName || !watchedValues.lastName || !watchedValues.email || !watchedValues.phone) {
          return false;
        }
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(watchedValues.email)) {
          toast.error("Please enter a valid email address");
          return false;
        }
        return contactValid;
      }
      case 3:
        if (!watchedValues.storeName) {
          toast.error("Please enter your store name");
          return false;
        }
        return true;
      case 4:
        if (!watchedValues.storeCategory) {
          toast.error("Please select a store category");
          return false;
        }
        if (watchedValues.storeCategory === "other" && !watchedValues.customCategory) {
          toast.error("Please specify your store category");
          return false;
        }
        return true;
      case 5:
        if (!watchedValues.city || !watchedValues.state || !watchedValues.country) {
          toast.error("Please complete all location fields");
          return false;
        }
        return true;
      case 6:
        // At least one must be filled
        if (!watchedValues.websiteUrl && !watchedValues.instagramHandle) {
          toast.error("Please provide either a website or Instagram handle");
          return false;
        }
        // URL validation if provided
        if (watchedValues.websiteUrl) {
          const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
          if (!urlRegex.test(watchedValues.websiteUrl)) {
            toast.error("Please enter a valid website URL");
            return false;
          }
        }
        return true;
      case 8:
        if (!watchedValues.confirmAccuracy) {
          toast.error("Please confirm the accuracy of your information");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleContinue = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleSubmit = async () => {
    const isValid = await validateStep(8);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const values = getValues();
      
      // Map form data to retailer_applications table columns
      const applicationData = {
        buyer_name: `${values.firstName} ${values.lastName}`.trim(),
        buyer_email: values.email,
        phone: values.phone,
        shop_name: values.storeName,
        interested_categories: [values.storeCategory === "other" ? values.customCategory : values.storeCategory],
        city: values.city,
        state: values.state,
        country: values.country,
        shop_url: values.websiteUrl || null,
        instagram_handle: values.instagramHandle?.replace("@", "") || null,
        additional_notes: JSON.stringify({
          storeType: values.storeType,
          storeSize: values.storeSize,
          yearsInBusiness: values.yearsInBusiness,
          optInUpdates: values.optInUpdates,
        }),
        status: "pending",
        submitted_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("retailer_applications")
        .insert(applicationData);

      if (error) throw error;

      // Clear localStorage on successful submission
      localStorage.removeItem(STORAGE_KEY);

      setIsSubmitted(true);
      setCurrentStep(9);

      // Send application received confirmation email (fire and forget)
      try {
        const formValues = getValues();
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-application-received-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              email: formValues.email,
              firstName: formValues.firstName,
              businessName: formValues.storeName,
              role: 'retailer',
            }),
          }
        );
      } catch (emailError) {
        // Don't fail the submission if email fails
        console.error('Failed to send confirmation email:', emailError);
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && currentStep > 1 && currentStep < 8) {
      e.preventDefault();
      handleContinue();
    }
  }, [currentStep]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Render step content
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
              Let's get your store on Neesh
            </h1>
            <p className="text-body text-muted-foreground mb-8">
              This takes about 2 minutes. We review applications within 2-3 business days.
            </p>
            <ButtonPrimary onClick={() => setCurrentStep(2)} fullWidth>
              Get Started
            </ButtonPrimary>
          </div>
        );

      case 2:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-6">
              First, tell us about yourself
            </h1>
            <div className="space-y-4 mb-8">
              <Controller
                name="firstName"
                control={control}
                rules={{ required: "First name is required" }}
                render={({ field }) => (
                  <FormInput
                    label="First Name"
                    placeholder="Your first name"
                    error={errors.firstName?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="lastName"
                control={control}
                rules={{ required: "Last name is required" }}
                render={({ field }) => (
                  <FormInput
                    label="Last Name"
                    placeholder="Your last name"
                    error={errors.lastName?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="email"
                control={control}
                rules={{ 
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Please enter a valid email"
                  }
                }}
                render={({ field }) => (
                  <FormInput
                    label="Email Address"
                    type="email"
                    placeholder="you@yourstore.com"
                    error={errors.email?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="phone"
                control={control}
                rules={{ required: "Phone number is required" }}
                render={({ field }) => (
                  <FormInput
                    label="Phone Number"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    error={errors.phone?.message}
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

      case 3:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-6">
              What's your store called?
            </h1>
            <div className="mb-8">
              <Controller
                name="storeName"
                control={control}
                rules={{ required: "Store name is required" }}
                render={({ field }) => (
                  <FormInput
                    label="Store Name"
                    placeholder="e.g., McNally Jackson, Arcana Books, Café Integral"
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

      case 4:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-6">
              What kind of store is it?
            </h1>
            <div className="space-y-3 mb-6">
              {STORE_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setValue("storeCategory", category.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left
                    ${watchedValues.storeCategory === category.id 
                      ? "border-accent bg-accent/5" 
                      : "border-border hover:border-muted-foreground/50 bg-secondary"
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${watchedValues.storeCategory === category.id 
                      ? "border-accent" 
                      : "border-muted-foreground"
                    }
                  `}>
                    {watchedValues.storeCategory === category.id && (
                      <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                    )}
                  </div>
                  <span className="font-medium text-foreground">{category.label}</span>
                </button>
              ))}
            </div>
            
            {watchedValues.storeCategory === "other" && (
              <div className="mb-6 animate-fade-in">
                <Controller
                  name="customCategory"
                  control={control}
                  render={({ field }) => (
                    <FormInput
                      label="Specify your store type"
                      placeholder="e.g., Record Store, Design Studio"
                      {...field}
                    />
                  )}
                />
              </div>
            )}
            
            <ButtonPrimary onClick={handleContinue} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 5:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-6">
              Where's your store located?
            </h1>
            <div className="space-y-4 mb-8">
              <Controller
                name="city"
                control={control}
                rules={{ required: "City is required" }}
                render={({ field }) => (
                  <FormInput
                    label="City"
                    placeholder="e.g., New York, London, Berlin"
                    error={errors.city?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="state"
                control={control}
                rules={{ required: "State/Region is required" }}
                render={({ field }) => (
                  <FormInput
                    label="State / Region / Province"
                    placeholder="e.g., New York, England, Bavaria"
                    error={errors.state?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="country"
                control={control}
                rules={{ required: "Country is required" }}
                render={({ field }) => (
                  <FormSelect
                    label="Country"
                    options={COUNTRIES}
                    placeholder="Select a country"
                    error={errors.country?.message}
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

      case 6:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-2">
              Where can we find you online?
            </h1>
            <p className="text-body text-muted-foreground mb-6">
              We use this to verify your store
            </p>
            <div className="space-y-4 mb-8">
              <Controller
                name="websiteUrl"
                control={control}
                render={({ field }) => (
                  <FormInput
                    label="Website URL"
                    placeholder="https://yourstore.com"
                    {...field}
                  />
                )}
              />
              <Controller
                name="instagramHandle"
                control={control}
                render={({ field }) => (
                  <FormInput
                    label="Instagram Handle"
                    placeholder="@yourstore"
                    {...field}
                    onChange={(value) => {
                      // Ensure @ prefix
                      const formatted = value.startsWith("@") ? value : `@${value}`;
                      field.onChange(formatted);
                    }}
                  />
                )}
              />
            </div>
            <p className="text-caption text-muted-foreground mb-4 text-center">
              At least one is required
            </p>
            <ButtonPrimary onClick={handleContinue} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 7:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-2">
              A bit more about your store
            </h1>
            <p className="text-body text-muted-foreground mb-6">
              Optional, but helps us understand your business
            </p>
            <div className="space-y-4 mb-8">
              <Controller
                name="storeType"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Store Type"
                    options={STORE_TYPES}
                    placeholder="Select store type"
                    {...field}
                  />
                )}
              />
              <Controller
                name="storeSize"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Store Size"
                    options={STORE_SIZES}
                    placeholder="Select store size"
                    {...field}
                  />
                )}
              />
              <Controller
                name="yearsInBusiness"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Years in Business"
                    options={YEARS_IN_BUSINESS}
                    placeholder="Select years in business"
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

      case 8:
        return (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-6">
              Almost done!
            </h1>
            
            {/* Summary Card */}
            <div className="card-neesh mb-6">
              <h3 className="font-medium text-foreground mb-4">Application Summary</h3>
              <div className="space-y-3 text-body">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store</span>
                  <span className="text-foreground font-medium">{watchedValues.storeName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="text-foreground font-medium">
                    {watchedValues.storeCategory === "other" 
                      ? watchedValues.customCategory 
                      : STORE_CATEGORIES.find(c => c.id === watchedValues.storeCategory)?.label || "—"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-foreground font-medium">
                    {watchedValues.city && watchedValues.country 
                      ? `${watchedValues.city}, ${watchedValues.country}` 
                      : "—"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground font-medium">{watchedValues.email || "—"}</span>
                </div>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-4 mb-8">
              <Controller
                name="confirmAccuracy"
                control={control}
                render={({ field }) => (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                    <span className="text-body text-foreground">
                      I confirm that all details are accurate and I'm interested in stocking independent magazines through Neesh
                    </span>
                  </label>
                )}
              />
              <Controller
                name="optInUpdates"
                control={control}
                render={({ field }) => (
                  <label className="flex items-start gap-3 cursor-pointer">
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

            <ButtonPrimary 
              onClick={handleSubmit} 
              fullWidth 
              disabled={isSubmitting || !watchedValues.confirmAccuracy}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </ButtonPrimary>
          </div>
        );

      case 9:
        return (
          <div className="animate-fade-in text-center">
            {/* Checkmark icon */}
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
            </div>

            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-4">
              Application Received!
            </h1>
            
            <p className="text-body text-muted-foreground mb-2">
              Thanks for applying to Neesh. We'll review your application and get back to you at{" "}
              <span className="font-medium text-foreground">{watchedValues.email}</span> within 2-3 business days.
            </p>
            
            <p className="text-caption text-muted-foreground mb-8">
              Questions? Reach out to{" "}
              <a 
                href="mailto:hi@neesh.art" 
                className="text-foreground hover:text-accent transition-colors"
              >
                hi@neesh.art
              </a>
            </p>

            <ButtonSecondary onClick={() => navigate("/")} fullWidth>
              Back to Home
            </ButtonSecondary>
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
          {currentStep > 1 && currentStep < 9 && (
            <span className="text-sm text-muted-foreground">
              Step {currentStep - 1} of {TOTAL_STEPS - 2}
            </span>
          )}
        </div>
        
        {/* Progress bar */}
        {currentStep > 1 && currentStep < 9 && (
          <div className="h-1 bg-secondary">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (TOTAL_STEPS - 2)) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Back button - positioned below header */}
      {currentStep > 1 && currentStep < 9 && (
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
          {renderStep()}
        </div>
      </main>
    </div>
  );
};
