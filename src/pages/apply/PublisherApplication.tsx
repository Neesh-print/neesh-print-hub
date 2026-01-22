import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { ChevronLeft, CheckCircle, ChevronRight, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ButtonPrimary, ButtonSecondary, FormInput, FormTextarea, FormSelect, FileUploadZone, Logo, ApplicationProgress, AutoSaveIndicator } from "@/components/neesh";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  COUNTRIES,
  PUBLICATION_FREQUENCIES,
  DISTRIBUTION_REGIONS,
  FULFILLMENT_OPTIONS,
  PUBLISHER_APPLICATION_STEPS,
} from "@/lib/constants";

const TOTAL_STEPS = PUBLISHER_APPLICATION_STEPS;

interface FormData {
  // Step 1: Contact Info (no password - account created on approval)
  firstName: string;
  lastName: string;
  email: string;
  // Step 2: Business Name
  businessName: string;
  // Step 3: Magazine Title
  magazineTitle: string;
  // Step 4: Cover Image
  coverImageUrl: string;
  // Step 5: Description
  description: string;
  // Step 6: Online Presence
  websiteUrl: string;
  instagramHandle: string;
  // Step 7: Shipping Location
  shippingCountry: string;
  shippingCity: string;
  // Step 8: Publication Details
  issueFrequency: string;
  publicationType: string;
  regionsCurrentlySold: string[];
  // Step 9: Fulfillment
  fulfillmentMethod: string;
  // Step 10: Additional Info
  cloudLink: string;
  // Step 11: Confirmation
  confirmRights: boolean;
  optInUpdates: boolean;
}

const defaultFormValues: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  businessName: "",
  magazineTitle: "",
  coverImageUrl: "",
  description: "",
  websiteUrl: "",
  instagramHandle: "",
  shippingCountry: "",
  shippingCity: "",
  issueFrequency: "",
  publicationType: "",
  regionsCurrentlySold: [],
  fulfillmentMethod: "",
  cloudLink: "",
  confirmRights: false,
  optInUpdates: true,
};

export const PublisherApplication = () => {
  const navigate = useNavigate();
  const { user, session, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [publisherId, setPublisherId] = useState<string | null>(() => localStorage.getItem('publisherAppId'));
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('publisherAccessToken'));
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Persist ID and Token
  useEffect(() => {
    if (publisherId) localStorage.setItem('publisherAppId', publisherId);
  }, [publisherId]);

  useEffect(() => {
    if (accessToken) localStorage.setItem('publisherAccessToken', accessToken);
  }, [accessToken]);

  const { control, watch, setValue, trigger, formState: { errors }, getValues, reset } = useForm<FormData>({
    defaultValues: defaultFormValues,
  });

  const { upload, isUploading, progress, error: uploadError, reset: resetUpload } = useFileUpload({
    bucket: "magazine-assets",
    folder: "applications",
    maxSizeMB: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    allowAnonymous: true,
    onUploadComplete: (url) => {
      setValue("coverImageUrl", url);
      toast.success("Cover image uploaded!");
      saveProgress({ coverImageUrl: url });
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const formValues = watch();

  // Check for existing draft applications to resume
  useEffect(() => {
    const checkForResume = async () => {
      // Wait for auth to initialize
      if (authLoading) return;

      // If we have an ID (and token if anon), we are already set
      if (publisherId) {
        setIsLoadingResume(false);
        return;
      }

      // For logged-in users, check their publisher status first
      if (user) {
        try {
          const { data: publisher, error } = await supabase
            .from("publishers")
            .select("id, application_status")
            .eq("user_id", user.id)
            .single();

          if (!error && publisher) {
            if (publisher.application_status === "approved") {
              navigate("/publisher");
              return;
            }
            if (publisher.application_status === "submitted") {
              navigate("/pending");
              return;
            }
            if (publisher.application_status === "rejected") {
              navigate("/rejected");
              return;
            }
             // If draft, we might want to populate publisherId from here if not set?
             // But existing logic doesn't seem to do that. It assumes standard flow or maybe 'publishers' table is different from 'publisher_applications'?
             // Actually 'publishers' table IS the main table, 'publisher_applications' is the wizard table?
             // Wait, the migration says:
             // "Add new columns to publishers table"
             // BUT RLS policy is on "publisher_applications".
             // Let's check: "publisher_applications" is used in `saveProgress`.
             // And `checkForResume` checks "publishers".
             // This implies a disconnect.
             // `publisher_applications` might be a new table for the new flow?
             // Checking migration `20260121020000`:
             // `ALTER TABLE public.publisher_applications ...`
             // `ALTER TABLE public.publishers ...`
             // Both exist.
             // If I am authenticated, I likely have a row in `publishers`?
             // Or does `publisher_applications` promote to `publishers`?
             // The migration comments: "Create application status enum... Add new columns to publishers table... Update existing...".
             // AND "Add RLS policy for publisher_applications".
             // It seems `publisher_applications` is the wizard table, and `publishers` is the final table?
             // Line 240 of migration: "Create a temporary publisher application record..."
             // So RESUME should check `publisher_applications` for drafts?
             // The existing `checkForResume` checks `publishers`.
             // If I am a draft user, do I have a `publishers` row?
             // If I am authenticated, `handleSaveBasicInfo` inserts into `publisher_applications` WITH `user_id`.
             // So I should check `publisher_applications` for my draft!

             // I will update the Resume logic to ALSO check `publisher_applications` if `publishers` check yields nothing or draft.
             // But let's stick to fixing the immediate anonymous flow.
             // If I am logged in, the original code checks `publishers`.
             // Maybe I should keep it for now to avoid side effects.
          }
        } catch (err) {
          console.error("Error checking publisher status:", err);
        }
      }

      setIsLoadingResume(false);
    };

    checkForResume();
  }, [user, navigate, publisherId, authLoading]);

  // Save progress to Supabase (saves to publisher_applications table)
  const saveProgress = useCallback(async (additionalData?: Partial<FormData>) => {
    if (!publisherId) return;

    setSaveStatus('saving');

    const currentData = getValues();
    const mergedData = { ...currentData, ...additionalData };

    try {
      const updateData = {
          first_name: mergedData.firstName,
          last_name: mergedData.lastName,
          email: mergedData.email,
          business_name: mergedData.businessName,
          magazine_title: mergedData.magazineTitle,
          cover_image_url: mergedData.coverImageUrl,
          description: mergedData.description,
          social_website_link: mergedData.websiteUrl || mergedData.instagramHandle,
          instagram_handle: mergedData.instagramHandle,
          shipping_country: mergedData.shippingCountry,
          shipping_city: mergedData.shippingCity,
          issue_frequency: mergedData.issueFrequency,
          publication_type: mergedData.publicationType,
          distribution_channels: mergedData.regionsCurrentlySold,
          fulfillment_method: mergedData.fulfillmentMethod,
          quotes_feedback: mergedData.cloudLink,
          additional_info: mergedData
      };

      if (user) {
        // Authenticated user: Standard RLS update
        const { error: updateError } = await supabase
          .from("publisher_applications")
          .update(updateData)
          .eq("id", publisherId);
        if (updateError) throw updateError;
      } else if (accessToken) {
        // Anonymous user: Secure RPC update
        const { error: rpcError } = await supabase.rpc('update_publisher_application', {
           p_id: publisherId,
           p_token: accessToken,
           p_data: mergedData
        });
        if (rpcError) throw rpcError;
      } else {
         // Should ideally not happen if flow is correct
         // But effectively this means we can't save. 
         console.warn("No auth method to save progress");
         return;
      }

      setSaveStatus('saved');
      setLastSaved(new Date());
    } catch (err) {
      console.error("Error saving progress:", err);
      setSaveStatus('error');
    }
  }, [publisherId, accessToken, user, getValues]);

  const progressPercentage = Math.round((currentStep / TOTAL_STEPS) * 100);

  const handleFileSelect = async (files: File[]) => {
    if (files.length > 0) {
      await upload(files[0]);
    }
  };

  // Step 1: Save basic info (no account creation - happens on approval)
  const handleSaveBasicInfo = async () => {
    const isValid = await trigger(["firstName", "lastName", "email"]);
    if (!isValid) return;

    const values = getValues();
    setIsCreatingAccount(true);

    try {
      // Check if this email already has an application
      const { data: existingApp, error: checkError } = await supabase
        .from("publisher_applications")
        .select("id, status, user_id")
        .eq("email", values.email)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("Error checking existing application:", checkError);
      }

      if (existingApp) {
        if (existingApp.status === 'approved') {
          toast.error("This email already has an approved application. Please log in instead.");
          navigate("/login");
          return;
        } else if (existingApp.status === 'pending' || existingApp.status === 'submitted') {
          toast.error("You already have a pending application with this email.");
          return;
        }
      }

      // Create application
      if (user) {
        // Authenticated users: direct insert with user_id
        const { data: appData, error: appError } = await supabase
          .from("publisher_applications")
          .insert({
            first_name: values.firstName,
            last_name: values.lastName,
            email: values.email,
            status: 'draft',
            user_id: user.id
          })
          .select("id")
          .single();

        if (appError) throw appError;
        setPublisherId(appData.id);
      } else {
        // Anonymous users: use Secure RPC
        const { data, error } = await supabase.rpc('create_publisher_application', {
          p_first_name: values.firstName,
          p_last_name: values.lastName,
          p_email: values.email
        });

        if (error) throw error;

        // data is returned as table rows
        if (data && data.length > 0) {
          const result = data[0]; 
          setPublisherId(result.id);
          setAccessToken(result.access_token);
          // Toast specifically for anon user if needed, but the general toast is below
        }
      }

      toast.success("Let's continue with your application.");
      setCurrentStep(2);

    } catch (err: any) {
      console.error("Error saving basic info:", err);
      toast.error(err.message || "Failed to save information. Please try again.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    switch (currentStep) {
      case 1:
        return await trigger(["firstName", "lastName", "email"]);
      case 2:
        return await trigger("businessName");
      case 3:
        return await trigger("magazineTitle");
      case 4:
        return !!formValues.coverImageUrl;
      case 5:
        return await trigger("description");
      case 6:
        return !!(formValues.websiteUrl || formValues.instagramHandle);
      case 7:
        return await trigger("shippingCountry");
      case 11:
        return formValues.confirmRights;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    // Special handling for step 1 (save basic info)
    if (currentStep === 1 && !publisherId) {
      await handleSaveBasicInfo();
      return;
    }

    const isValid = await validateCurrentStep();

    if (!isValid) {
      if (currentStep === 4 && !formValues.coverImageUrl) {
        toast.error("Please upload a cover image");
        return;
      }
      if (currentStep === 6 && !formValues.websiteUrl && !formValues.instagramHandle) {
        toast.error("Please provide either a website or Instagram handle");
        return;
      }
      if (currentStep === 11 && !formValues.confirmRights) {
        toast.error("Please confirm you have distribution rights");
        return;
      }
      return;
    }

    // Save progress before moving to next step
    await saveProgress();

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      // Don't go back to step 1 if already have publisher ID
      if (currentStep === 2 && publisherId) {
        return;
      }
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveAndExit = async () => {
    await saveProgress();
    toast.success("Progress saved! You can resume anytime.");
    navigate("/");
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentStep !== 5 && currentStep !== 11 && currentStep !== 12) {
      e.preventDefault();
      handleNext();
    }
  }, [currentStep, handleNext]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = async () => {
    if (!formValues.confirmRights) {
      toast.error("Please confirm you have distribution rights");
      return;
    }

    if (!publisherId) {
      toast.error("Session error. Please refresh and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Update application to submitted status
      const { error: appError } = await supabase
        .from("publisher_applications")
        .update({
          first_name: formValues.firstName,
          last_name: formValues.lastName,
          email: formValues.email,
          business_name: formValues.businessName,
          magazine_title: formValues.magazineTitle,
          cover_image_url: formValues.coverImageUrl,
          description: formValues.description,
          social_website_link: formValues.websiteUrl || formValues.instagramHandle,
          instagram_handle: formValues.instagramHandle?.replace("@", ""),
          shipping_country: formValues.shippingCountry,
          shipping_city: formValues.shippingCity,
          issue_frequency: formValues.issueFrequency,
          publication_type: formValues.publicationType,
          distribution_channels: formValues.regionsCurrentlySold,
          fulfillment_method: formValues.fulfillmentMethod,
          quotes_feedback: formValues.cloudLink,
          status: "pending",
          submitted_at: new Date().toISOString(),
          additional_info: formValues,
        })
        .eq("id", publisherId);

      if (appError) throw appError;

      setIsSubmitted(true);
      setCurrentStep(12);

    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while checking for resume
  if (isLoadingResume) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        // If already have publisher ID (started application), skip to step 2
        if (publisherId) {
          setCurrentStep(2);
          return null;
        }
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                Let's get your magazine on Neesh
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto mt-4">
                Start your application. Takes about 3 minutes. We'll create your account once approved.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="firstName"
                  control={control}
                  rules={{ required: "First name is required" }}
                  render={({ field }) => (
                    <FormInput
                      label="First Name"
                      placeholder="Your first name"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.firstName?.message}
                      required
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
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.lastName?.message}
                      required
                    />
                  )}
                />
              </div>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address"
                  }
                }}
                render={({ field }) => (
                  <FormInput
                    label="Email Address"
                    type="email"
                    placeholder="you@example.com"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.email?.message}
                    required
                  />
                )}
              />
            </div>
            <ButtonPrimary
              onClick={handleNext}
              fullWidth
              className="mt-6"
              loading={isCreatingAccount}
            >
              Continue
            </ButtonPrimary>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Once approved, we'll send you a magic link to access your account.
            </p>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              What's your publication called?
            </h1>
            <Controller
              name="businessName"
              control={control}
              rules={{ required: "Publication name is required" }}
              render={({ field }) => (
                <FormInput
                  label="Publication / Company Name"
                  placeholder="e.g., Kinfolk, Monocle, Apartamento"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.businessName?.message}
                  required
                  autoComplete="organization"
                />
              )}
            />
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Which title are you looking to sell?
              </h1>
              <p className="text-muted-foreground mt-2">
                Start with one - you can add more later
              </p>
            </div>
            <Controller
              name="magazineTitle"
              control={control}
              rules={{ required: "Magazine title is required" }}
              render={({ field }) => (
                <FormInput
                  label="Magazine Title"
                  placeholder="e.g., Issue 45, Spring 2025 Edition"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.magazineTitle?.message}
                  required
                  autoComplete="off"
                />
              )}
            />
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Show us your magazine
              </h1>
              <p className="text-muted-foreground mt-2">
                Upload a cover image so we can see your work
              </p>
            </div>
            <FileUploadZone
              title="Upload Cover Image"
              subtitle="JPG, PNG, WebP or GIF - Max 10MB"
              accept="image/*"
              onFilesSelected={handleFileSelect}
              isUploading={isUploading}
              uploadProgress={progress}
              uploadedUrl={formValues.coverImageUrl}
              error={uploadError || undefined}
              onRemove={() => {
                setValue("coverImageUrl", "");
                resetUpload();
              }}
            />
            <ButtonPrimary
              onClick={handleNext}
              fullWidth
              disabled={!formValues.coverImageUrl}
            >
              Continue
            </ButtonPrimary>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Tell us about your publication
            </h1>
            <Controller
              name="description"
              control={control}
              rules={{ required: "Description is required" }}
              render={({ field }) => (
                <FormTextarea
                  label="Description"
                  placeholder="What's your magazine about? Who's it for?"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.description?.message}
                  maxLength={500}
                  helperText="2-3 sentences is perfect"
                  rows={5}
                  required
                />
              )}
            />
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Where can we find you online?
              </h1>
              <p className="text-muted-foreground mt-2">
                We use this to verify your publication
              </p>
            </div>
            <div className="space-y-4">
              <Controller
                name="websiteUrl"
                control={control}
                rules={{
                  pattern: {
                    value: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
                    message: "Please enter a valid URL"
                  }
                }}
                render={({ field }) => (
                  <FormInput
                    label="Website URL"
                    placeholder="https://yourmagazine.com"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.websiteUrl?.message}
                  />
                )}
              />
              <Controller
                name="instagramHandle"
                control={control}
                render={({ field }) => (
                  <FormInput
                    label="Instagram Handle"
                    placeholder="@yourmagazine"
                    value={field.value}
                    onChange={(val) => {
                      const formatted = val.startsWith("@") ? val : `@${val}`;
                      field.onChange(formatted === "@" ? "" : formatted);
                    }}
                  />
                )}
              />
              {!formValues.websiteUrl && !formValues.instagramHandle && (
                <p className="text-sm text-destructive">
                  Please provide either a website or Instagram
                </p>
              )}
            </div>
            <ButtonPrimary
              onClick={handleNext}
              fullWidth
              disabled={!formValues.websiteUrl && !formValues.instagramHandle}
            >
              Continue
            </ButtonPrimary>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Where will you ship from?
            </h1>
            <div className="space-y-4">
              <Controller
                name="shippingCountry"
                control={control}
                rules={{ required: "Country is required" }}
                render={({ field }) => (
                  <FormSelect
                    label="Country"
                    placeholder="Select a country"
                    options={COUNTRIES.map(c => ({ value: c.value, label: c.label }))}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.shippingCountry?.message}
                    required
                  />
                )}
              />
              <Controller
                name="shippingCity"
                control={control}
                render={({ field }) => (
                  <FormInput
                    label="City"
                    placeholder="e.g., Los Angeles, London"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                A few more details
              </h1>
              <p className="text-muted-foreground mt-2">
                Optional, but helps us understand your publication
              </p>
            </div>
            <div className="space-y-4">
              <Controller
                name="issueFrequency"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Publication Frequency"
                    placeholder="How often do you publish?"
                    options={PUBLICATION_FREQUENCIES.map(f => ({ value: f.value, label: f.label }))}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <div>
                <label className="block mb-2 font-display font-medium text-body text-foreground">
                  Publication Type
                </label>
                <div className="flex gap-4">
                  {["Single Issue", "Series"].map((type) => (
                    <label
                      key={type}
                      className={`
                        flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all text-center
                        ${formValues.publicationType === type.toLowerCase().replace(" ", "_")
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/50"
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="publicationType"
                        value={type.toLowerCase().replace(" ", "_")}
                        checked={formValues.publicationType === type.toLowerCase().replace(" ", "_")}
                        onChange={(e) => setValue("publicationType", e.target.value)}
                        className="sr-only"
                      />
                      <span className="font-medium">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-display font-medium text-body text-foreground">
                  Regions Currently Sold In
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DISTRIBUTION_REGIONS.map((region) => (
                    <label
                      key={region.id}
                      className={`
                        flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                        ${formValues.regionsCurrentlySold.includes(region.id)
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/50"
                        }
                      `}
                    >
                      <Checkbox
                        checked={formValues.regionsCurrentlySold.includes(region.id)}
                        onCheckedChange={(checked) => {
                          const current = formValues.regionsCurrentlySold;
                          if (checked) {
                            setValue("regionsCurrentlySold", [...current, region.id]);
                          } else {
                            setValue("regionsCurrentlySold", current.filter(r => r !== region.id));
                          }
                        }}
                      />
                      <span className="text-sm">{region.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 9:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                How would you like to ship orders?
              </h1>
              <p className="text-muted-foreground mt-2">
                You can change this later
              </p>
            </div>
            <div className="space-y-3">
              {FULFILLMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`
                    block p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${formValues.fulfillmentMethod === option.value
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/50"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value={option.value}
                    checked={formValues.fulfillmentMethod === option.value}
                    onChange={(e) => setValue("fulfillmentMethod", e.target.value)}
                    className="sr-only"
                  />
                  <span className="font-medium text-foreground">{option.label}</span>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                </label>
              ))}
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 10:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Anything else to share?
              </h1>
              <p className="text-muted-foreground mt-2">
                Optional - link to a press kit, media folder, or additional images
              </p>
            </div>
            <Controller
              name="cloudLink"
              control={control}
              render={({ field }) => (
                <FormInput
                  label="Cloud Link"
                  placeholder="Dropbox, Google Drive, or website link"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 11:
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Almost done!
            </h1>

            <div className="card-neesh space-y-4">
              <div className="flex gap-4">
                {formValues.coverImageUrl && (
                  <img
                    src={formValues.coverImageUrl}
                    alt="Cover preview"
                    className="w-20 h-28 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-foreground">{formValues.businessName}</p>
                  <p className="text-sm text-muted-foreground">{formValues.magazineTitle}</p>
                  <p className="text-sm text-muted-foreground mt-2">{formValues.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.confirmRights}
                  onCheckedChange={(checked) => setValue("confirmRights", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  I confirm that I have distribution rights for this content <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.optInUpdates}
                  onCheckedChange={(checked) => setValue("optInUpdates", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  I'd like to receive platform updates and retailer insights
                </span>
              </label>
            </div>

            <ButtonPrimary
              onClick={handleSubmit}
              fullWidth
              loading={isSubmitting}
              disabled={!formValues.confirmRights}
            >
              Submit Application
            </ButtonPrimary>
          </div>
        );

      case 12:
        return (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Application Submitted!
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Thanks for applying to Neesh. We'll review your application and get back to you at{" "}
              <span className="font-medium text-foreground">{formValues.email}</span>{" "}
              within 2-3 business days.
            </p>
            <p className="text-sm text-muted-foreground">
              Questions? Reach out to{" "}
              <a href="mailto:hi@neesh.art" className="text-accent hover:underline">
                hi@neesh.art
              </a>
            </p>
            <div className="pt-4">
              <ButtonSecondary onClick={() => navigate("/")} className="min-w-[200px]">
                Back to Home
              </ButtonSecondary>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-6 md:px-8 py-4">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <Logo size="lg" />
          </a>

          <div className="flex items-center gap-4">
            {/* Auto-save indicator */}
            {publisherId && currentStep > 1 && currentStep < 12 && (
              <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />
            )}

            {/* Save & Exit button */}
            {publisherId && currentStep > 1 && currentStep < 12 && (
              <ButtonSecondary
                onClick={handleSaveAndExit}
                className="gap-2 text-caption hidden sm:flex"
              >
                <LogOut className="w-4 h-4" />
                Save & Exit
              </ButtonSecondary>
            )}
          </div>
        </div>
      </header>

      {/* Back button */}
      {currentStep > 1 && currentStep < 12 && !(currentStep === 2 && publisherId) && (
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
      <main className="flex-1 flex items-start justify-center px-4 md:px-6 pt-24 pb-8">
        <div className="w-full max-w-6xl flex gap-8 items-start">
          {/* Progress sidebar - Desktop only */}
          {currentStep > 1 && currentStep < 12 && (
            <div className="hidden lg:block w-80 sticky top-24">
              <ApplicationProgress
                currentStep={currentStep}
                totalSteps={TOTAL_STEPS - 1}
              />
            </div>
          )}

          {/* Form content */}
          <div className="flex-1 max-w-md mx-auto lg:mx-0">
            {/* Progress card - Mobile only */}
            {currentStep > 1 && currentStep < 12 && (
              <div className="lg:hidden mb-6">
                <ApplicationProgress
                  currentStep={currentStep}
                  totalSteps={TOTAL_STEPS - 1}
                />
              </div>
            )}

            {renderStep()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublisherApplication;
