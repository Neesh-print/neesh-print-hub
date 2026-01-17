import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, CheckCircle, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ButtonPrimary, ButtonSecondary, FileUploadZone } from "@/components/neesh";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const STORAGE_KEY = "neesh_publisher_application";
const TOTAL_STEPS = 13;

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "AU", label: "Australia" },
  { value: "NL", label: "Netherlands" },
  { value: "Other", label: "Other" },
];

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Biannual" },
  { value: "annual", label: "Annual" },
  { value: "irregular", label: "Irregular" },
];

const REGIONS = [
  { id: "north_america", label: "North America" },
  { id: "eu", label: "EU" },
  { id: "uk", label: "UK Only" },
  { id: "asia_pacific", label: "Asia Pacific" },
  { id: "africa", label: "Africa" },
  { id: "south_america", label: "South America" },
  { id: "na", label: "N/A" },
];

const FULFILLMENT_OPTIONS = [
  { 
    value: "neesh", 
    label: "Neesh Fulfillment", 
    description: "Send us inventory, we handle shipping" 
  },
  { 
    value: "self", 
    label: "Self Fulfillment", 
    description: "You ship directly to retailers" 
  },
  { 
    value: "third_party", 
    label: "Third Party Fulfillment", 
    description: "You use a distributor or 3PL" 
  },
  { 
    value: "not_sure", 
    label: "Not sure yet", 
    description: "We'll figure it out together" 
  },
];

// Typeform-style components
interface TypeformInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
}

const TypeformInput = ({ label, placeholder, value, onChange, error, required, type = "text" }: TypeformInputProps) => (
  <div className="space-y-2">
    <label className="block text-base font-normal text-foreground">
      {label}{required && <span className="text-muted-foreground">*</span>}
    </label>
    <input
      type={type}
      placeholder={placeholder || "Type your answer here..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-typeform"
    />
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

interface TypeformTextareaProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  maxLength?: number;
  helperText?: string;
}

const TypeformTextarea = ({ label, placeholder, value, onChange, error, required, maxLength, helperText }: TypeformTextareaProps) => (
  <div className="space-y-2">
    <label className="block text-base font-normal text-foreground">
      {label}{required && <span className="text-muted-foreground">*</span>}
    </label>
    <textarea
      placeholder={placeholder || "Type your answer here..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      rows={4}
      className="input-typeform resize-none min-h-[120px]"
    />
    <div className="flex justify-between text-sm text-muted-foreground">
      {helperText && <span>{helperText}</span>}
      {maxLength && <span>{value.length}/{maxLength}</span>}
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

interface TypeformSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

const TypeformSelect = ({ label, options, value, onChange, error, required }: TypeformSelectProps) => {
  const [search, setSearch] = useState("");
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <label className="block text-base font-normal text-foreground">
        {label}{required && <span className="text-muted-foreground">*</span>}
      </label>
      <div className="relative">
        <div className="flex items-center border-b-2 border-border focus-within:border-accent transition-colors">
          <input
            type="text"
            placeholder="Type or select an option"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent py-3 text-lg placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <Search className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="mt-4 space-y-2 max-h-[280px] overflow-y-auto">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setSearch(option.label);
              }}
              className={`option-card-typeform ${value === option.value ? 'selected' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

// Step number badge component
const StepBadge = ({ step }: { step: number }) => (
  <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-secondary text-sm font-medium text-foreground mr-3">
    {step}
  </span>
);

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  magazineTitle: string;
  coverImageUrl: string;
  description: string;
  websiteUrl: string;
  instagramHandle: string;
  shippingCountry: string;
  shippingCity: string;
  issueFrequency: string;
  publicationType: string;
  regionsCurrentlySold: string[];
  fulfillmentMethod: string;
  cloudLink: string;
  confirmRights: boolean;
  optInUpdates: boolean;
}

export const PublisherApplication = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { control, watch, setValue, trigger, formState: { errors }, getValues } = useForm<FormData>({
    defaultValues: {
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
    },
  });

  const { upload, isUploading, progress, error: uploadError, reset: resetUpload } = useFileUpload({
    bucket: "magazine-assets",
    folder: "applications",
    maxSizeMB: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    onUploadComplete: (url) => {
      setValue("coverImageUrl", url);
      toast.success("Cover image uploaded!");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const formValues = watch();

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach((key) => {
          setValue(key as keyof FormData, parsed[key]);
        });
        // Don't restore step to allow fresh start
      } catch {
        // Ignore parse errors
      }
    }
  }, [setValue]);

  // Save to localStorage
  useEffect(() => {
    if (!isSubmitted) {
      const values = getValues();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    }
  }, [formValues, isSubmitted, getValues]);

  const progressPercentage = Math.round((currentStep / TOTAL_STEPS) * 100);

  const handleFileSelect = async (files: File[]) => {
    if (files.length > 0) {
      await upload(files[0]);
    }
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    switch (currentStep) {
      case 2:
        return await trigger(["firstName", "lastName", "email"]);
      case 3:
        return await trigger("businessName");
      case 4:
        return await trigger("magazineTitle");
      case 5:
        return !!formValues.coverImageUrl;
      case 6:
        return await trigger("description");
      case 7:
        return !!(formValues.websiteUrl || formValues.instagramHandle);
      case 8:
        return await trigger("shippingCountry");
      case 12:
        return formValues.confirmRights;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    
    if (!isValid) {
      if (currentStep === 5 && !formValues.coverImageUrl) {
        toast.error("Please upload a cover image");
        return;
      }
      if (currentStep === 7 && !formValues.websiteUrl && !formValues.instagramHandle) {
        toast.error("Please provide either a website or Instagram handle");
        return;
      }
      if (currentStep === 12 && !formValues.confirmRights) {
        toast.error("Please confirm you have distribution rights");
        return;
      }
      return;
    }
    
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentStep !== 6 && currentStep !== 12 && currentStep !== 13) {
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

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("publisher_applications").insert({
        first_name: formValues.firstName,
        last_name: formValues.lastName,
        email: formValues.email,
        business_name: formValues.businessName,
        magazine_title: formValues.magazineTitle,
        cover_image_url: formValues.coverImageUrl,
        description: formValues.description,
        social_website_link: formValues.websiteUrl || formValues.instagramHandle,
        shipping_country: formValues.shippingCountry,
        shipping_city: formValues.shippingCity,
        issue_frequency: formValues.issueFrequency,
        publication_type: formValues.publicationType,
        distribution_channels: formValues.regionsCurrentlySold,
        fulfillment_method: formValues.fulfillmentMethod,
        quotes_feedback: formValues.cloudLink, // Reusing this field for cloud link
        status: "pending",
      });

      if (error) throw error;

      // Clear localStorage on success
      localStorage.removeItem(STORAGE_KEY);
      setIsSubmitted(true);
      setCurrentStep(13);
      
      // TODO: Trigger notification to admin on new application (handled by DB trigger)
      
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6 animate-fade-in">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Let's get your magazine on Neesh
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              This takes about 3 minutes. We review applications within 2-3 business days.
            </p>
            <div className="pt-4">
              <ButtonPrimary onClick={handleNext} className="min-w-[200px]">
                Get Started <ChevronRight className="w-4 h-4 ml-1" />
              </ButtonPrimary>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
              <StepBadge step={1} />
              First, tell us a bit about you<span className="text-muted-foreground">*</span>
            </h1>
            <div className="space-y-6">
              <Controller
                name="firstName"
                control={control}
                rules={{ required: "First name is required" }}
                render={({ field }) => (
                  <TypeformInput
                    label="First Name"
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
                  <TypeformInput
                    label="Last Name"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.lastName?.message}
                    required
                  />
                )}
              />
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
                  <TypeformInput
                    label="Email Address"
                    type="email"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.email?.message}
                    required
                  />
                )}
              />
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth className="mt-8">
              Continue
            </ButtonPrimary>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
              <StepBadge step={2} />
              What's your publication called?<span className="text-muted-foreground">*</span>
            </h1>
            <Controller
              name="businessName"
              control={control}
              rules={{ required: "Publication name is required" }}
              render={({ field }) => (
                <TypeformInput
                  label="Publication / Company Name"
                  placeholder="e.g., Kinfolk, Monocle, Apartamento"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.businessName?.message}
                  required
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
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
                <StepBadge step={3} />
                Which title are you looking to sell?<span className="text-muted-foreground">*</span>
              </h1>
              <p className="text-muted-foreground mt-2 ml-10">
                Start with one - you can add more later
              </p>
            </div>
            <Controller
              name="magazineTitle"
              control={control}
              rules={{ required: "Magazine title is required" }}
              render={({ field }) => (
                <TypeformInput
                  label="Magazine Title"
                  placeholder="e.g., Issue 45, Spring 2025 Edition"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.magazineTitle?.message}
                  required
                />
              )}
            />
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 5:
        return (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
                <StepBadge step={4} />
                Show us your magazine<span className="text-muted-foreground">*</span>
              </h1>
              <p className="text-muted-foreground mt-2 ml-10">
                Upload a cover image so we can see your work
              </p>
            </div>
            <FileUploadZone
              title="Upload Cover Image"
              subtitle="JPG, PNG, WebP or GIF • Max 10MB"
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

      case 6:
        return (
          <div className="space-y-8 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
              <StepBadge step={5} />
              Tell us about your publication<span className="text-muted-foreground">*</span>
            </h1>
            <Controller
              name="description"
              control={control}
              rules={{ required: "Description is required" }}
              render={({ field }) => (
                <TypeformTextarea
                  label="Description"
                  placeholder="What's your magazine about? Who's it for?"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.description?.message}
                  maxLength={500}
                  helperText="2-3 sentences is perfect"
                  required
                />
              )}
            />
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 7:
        return (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
                <StepBadge step={6} />
                Where can we find you online?<span className="text-muted-foreground">*</span>
              </h1>
              <p className="text-muted-foreground mt-2 ml-10">
                We use this to verify your publication
              </p>
            </div>
            <div className="space-y-6">
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
                  <TypeformInput
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
                  <TypeformInput
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

      case 8:
        return (
          <div className="space-y-8 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
              <StepBadge step={7} />
              Where will you ship from?<span className="text-muted-foreground">*</span>
            </h1>
            <div className="space-y-6">
              <Controller
                name="shippingCountry"
                control={control}
                rules={{ required: "Country is required" }}
                render={({ field }) => (
                  <TypeformSelect
                    label="Country"
                    options={COUNTRIES}
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
                  <TypeformInput
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

      case 9:
        return (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
                <StepBadge step={8} />
                A few more details
              </h1>
              <p className="text-muted-foreground mt-2 ml-10">
                Optional, but helps us understand your publication
              </p>
            </div>
            <div className="space-y-6">
              <Controller
                name="issueFrequency"
                control={control}
                render={({ field }) => (
                  <TypeformSelect
                    label="Publication Frequency"
                    options={FREQUENCIES}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              
              <div className="space-y-3">
                <label className="block text-base font-normal text-foreground">
                  Publication Type
                </label>
                <div className="space-y-2">
                  {["Single Issue", "Series"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setValue("publicationType", type.toLowerCase().replace(" ", "_"))}
                      className={`option-card-typeform ${
                        formValues.publicationType === type.toLowerCase().replace(" ", "_") ? 'selected' : ''
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-base font-normal text-foreground">
                  Regions Currently Sold In
                </label>
                <div className="space-y-2">
                  {REGIONS.map((region) => (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => {
                        const current = formValues.regionsCurrentlySold;
                        if (current.includes(region.id)) {
                          setValue("regionsCurrentlySold", current.filter(r => r !== region.id));
                        } else {
                          setValue("regionsCurrentlySold", [...current, region.id]);
                        }
                      }}
                      className={`option-card-typeform ${
                        formValues.regionsCurrentlySold.includes(region.id) ? 'selected' : ''
                      }`}
                    >
                      {region.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 10:
        return (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
                <StepBadge step={9} />
                How would you like to ship orders?
              </h1>
              <p className="text-muted-foreground mt-2 ml-10">
                You can change this later
              </p>
            </div>
            <div className="space-y-2">
              {FULFILLMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValue("fulfillmentMethod", option.value)}
                  className={`option-card-typeform text-left ${
                    formValues.fulfillmentMethod === option.value ? 'selected' : ''
                  }`}
                >
                  <span className="font-medium text-foreground">{option.label}</span>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                </button>
              ))}
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case 11:
        return (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
                <StepBadge step={10} />
                Anything else to share?
              </h1>
              <p className="text-muted-foreground mt-2 ml-10">
                Optional - link to a press kit, media folder, or additional images
              </p>
            </div>
            <Controller
              name="cloudLink"
              control={control}
              render={({ field }) => (
                <TypeformInput
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

      case 12:
        return (
          <div className="space-y-8 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground flex items-center">
              <StepBadge step={11} />
              Almost done!
            </h1>
            
            <div className="bg-secondary/50 rounded-xl p-5 space-y-4">
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
              <button
                type="button"
                onClick={() => setValue("confirmRights", !formValues.confirmRights)}
                className={`option-card-typeform flex items-start gap-3 ${formValues.confirmRights ? 'selected' : ''}`}
              >
                <Checkbox
                  checked={formValues.confirmRights}
                  onCheckedChange={(checked) => setValue("confirmRights", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-left">
                  I confirm that I have distribution rights for this content <span className="text-destructive">*</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setValue("optInUpdates", !formValues.optInUpdates)}
                className={`option-card-typeform flex items-start gap-3 ${formValues.optInUpdates ? 'selected' : ''}`}
              >
                <Checkbox
                  checked={formValues.optInUpdates}
                  onCheckedChange={(checked) => setValue("optInUpdates", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-left text-muted-foreground">
                  I'd like to receive platform updates and retailer insights
                </span>
              </button>
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

      case 13:
        return (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Application Received!
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-background">
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          {/* Back button / Logo */}
          <div className="flex items-center gap-4">
            {currentStep > 1 && currentStep < 13 && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <a 
              href="/" 
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              neesh
            </a>
          </div>
          
          {/* Progress indicator */}
          {currentStep > 1 && currentStep < 13 && (
            <span className="text-sm text-muted-foreground">
              {currentStep - 1} of {TOTAL_STEPS - 2}
            </span>
          )}
        </div>
        
        {/* Progress bar */}
        {currentStep > 1 && currentStep < 13 && (
          <div className="h-1 bg-secondary">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 md:px-8 pt-24 pb-12">
        <div className="w-full max-w-xl">
          {renderStep()}
        </div>
      </main>
    </div>
  );
};

export default PublisherApplication;
