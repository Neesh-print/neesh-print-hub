import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Sparkles, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight,
  ArrowRight,
  BookOpen,
  Share2,
  ExternalLink,
  X
} from "lucide-react";
import { ButtonPrimary, ButtonSecondary, FormInput, FormTextarea, FileUploadZone } from "@/components/neesh";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { useFileUpload } from "@/hooks/useFileUpload";

const TOTAL_STEPS = 6;

interface OnboardingData {
  companyName: string;
  bio: string;
  location: string;
  websiteUrl: string;
  logoUrl: string;
  bannerUrl: string;
  firstTitle: {
    coverUrl: string;
    title: string;
    issueNumber: string;
    wholesalePrice: string;
    quantity: string;
    description: string;
  };
}

const initialData: OnboardingData = {
  companyName: "",
  bio: "",
  location: "",
  websiteUrl: "",
  logoUrl: "",
  bannerUrl: "",
  firstTitle: {
    coverUrl: "",
    title: "",
    issueNumber: "",
    wholesalePrice: "",
    quantity: "",
    description: "",
  },
};

export const PublisherOnboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const { publisher } = usePublisherProfile();
  const logoUpload = useFileUpload({ bucket: "magazine-assets", folder: "logos" });
  const bannerUpload = useFileUpload({ bucket: "magazine-assets", folder: "banners" });
  const coverUpload = useFileUpload({ bucket: "magazine-assets", folder: "covers" });

  // Pre-fill company name if available
  useEffect(() => {
    if (publisher?.company_name && !data.companyName) {
      setData(prev => ({ ...prev, companyName: publisher.company_name || "" }));
    }
  }, [publisher]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleSkipStep = () => {
    handleNext();
  };

  const handleSkipAll = () => {
    localStorage.setItem("neesh_publisher_onboarding_skipped", "true");
    navigate("/publisher");
  };

  const handleComplete = () => {
    localStorage.setItem("neesh_publisher_onboarding_complete", "true");
    // TODO: Save onboarding data to Supabase publisher profile
    navigate("/publisher");
  };

  const handleLogoUpload = async (files: File[]) => {
    if (files[0]) {
      const url = await logoUpload.upload(files[0]);
      if (url) {
        setData(prev => ({ ...prev, logoUrl: url }));
      }
    }
  };

  const handleBannerUpload = async (files: File[]) => {
    if (files[0]) {
      const url = await bannerUpload.upload(files[0]);
      if (url) {
        setData(prev => ({ ...prev, bannerUrl: url }));
      }
    }
  };

  const handleCoverUpload = async (files: File[]) => {
    if (files[0]) {
      const url = await coverUpload.upload(files[0]);
      if (url) {
        setData(prev => ({ 
          ...prev, 
          firstTitle: { ...prev.firstTitle, coverUrl: url } 
        }));
      }
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(step);
        setIsAnimating(false);
      }, 200);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">N</span>
            </div>
            <span className="font-display font-semibold text-lg">Neesh</span>
          </div>

          {/* Progress Indicator */}
          <div className="hidden md:flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <button
                key={i}
                onClick={() => goToStep(i + 1)}
                disabled={i + 1 > currentStep}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                  ${i + 1 < currentStep 
                    ? "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90" 
                    : i + 1 === currentStep 
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : "bg-secondary text-muted-foreground cursor-not-allowed"
                  }
                `}
              >
                {i + 1 < currentStep ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </button>
            ))}
          </div>

          {/* Mobile Progress */}
          <div className="md:hidden text-sm text-muted-foreground">
            Step {currentStep} of {TOTAL_STEPS}
          </div>

          {/* Skip */}
          <button 
            onClick={handleSkipAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-secondary">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-24 pb-8 px-4">
        <div className={`max-w-2xl mx-auto transition-opacity duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}>
          {currentStep === 1 && <StepWelcome data={data} onNext={handleNext} />}
          {currentStep === 2 && <StepProfileBasics data={data} setData={setData} onNext={handleNext} onSkip={handleSkipStep} onBack={handleBack} />}
          {currentStep === 3 && <StepBranding data={data} onNext={handleNext} onSkip={handleSkipStep} onBack={handleBack} logoUpload={logoUpload} bannerUpload={bannerUpload} onLogoUpload={handleLogoUpload} onBannerUpload={handleBannerUpload} />}
          {currentStep === 4 && <StepFirstTitle data={data} setData={setData} onNext={handleNext} onSkip={handleSkipStep} onBack={handleBack} coverUpload={coverUpload} onCoverUpload={handleCoverUpload} />}
          {currentStep === 5 && <StepPayout onNext={handleNext} onBack={handleBack} />}
          {currentStep === 6 && <StepComplete onComplete={handleComplete} />}
        </div>
      </main>
    </div>
  );
};

// Step 1: Welcome
const StepWelcome = ({ data, onNext }: { data: OnboardingData; onNext: () => void }) => {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      
      <h1 className="font-display font-bold text-display-md text-foreground mb-4">
        Welcome to Neesh{data.companyName ? `, ${data.companyName}` : ""}!
      </h1>
      
      <p className="text-body text-muted-foreground mb-8 max-w-md mx-auto">
        You're now part of a curated network of independent publishers and design-forward retailers. 
        Let's get your storefront set up in a few quick steps.
      </p>

      <div className="bg-secondary/50 rounded-xl p-6 mb-8 text-left max-w-sm mx-auto">
        <p className="font-display font-semibold text-sm text-foreground mb-4">What to expect:</p>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-primary font-medium">1</span>
            </div>
            Set up your profile (2 min)
          </li>
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-primary font-medium">2</span>
            </div>
            Add your first title (5 min)
          </li>
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-primary font-medium">3</span>
            </div>
            Start receiving orders
          </li>
        </ul>
      </div>

      <ButtonPrimary onClick={onNext} className="min-w-[200px]">
        Let's Go
        <ArrowRight className="w-4 h-4 ml-2" />
      </ButtonPrimary>
    </div>
  );
};

// Step 2: Profile Basics
const StepProfileBasics = ({ 
  data, 
  setData, 
  onNext, 
  onSkip,
  onBack 
}: { 
  data: OnboardingData; 
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) => {
  return (
    <div className="py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="font-display font-bold text-display-sm text-foreground mb-2">
        Tell retailers about yourself
      </h1>
      <p className="text-body text-muted-foreground mb-8">
        Help retailers discover and connect with your publication.
      </p>

      <div className="space-y-6">
        <FormInput
          label="Publication / Company Name"
          placeholder="e.g., Kinfolk Publishing"
          value={data.companyName}
          onChange={(value) => setData(prev => ({ ...prev, companyName: value }))}
        />

        <FormTextarea
          label="Short Bio"
          placeholder="A slow lifestyle magazine celebrating the simple things..."
          value={data.bio}
          onChange={(value) => setData(prev => ({ ...prev, bio: value }))}
          maxLength={280}
          rows={3}
        />

        <FormInput
          label="Location"
          placeholder="e.g., Portland, Oregon"
          value={data.location}
          onChange={(value) => setData(prev => ({ ...prev, location: value }))}
        />

        <FormInput
          label="Website URL"
          placeholder="https://yourwebsite.com"
          value={data.websiteUrl}
          onChange={(value) => setData(prev => ({ ...prev, websiteUrl: value }))}
        />
      </div>

      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mt-6">
        <p className="text-sm text-accent">
          💡 A complete profile helps retailers discover and trust you
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <ButtonPrimary onClick={onNext} className="flex-1">
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </ButtonPrimary>
        <button 
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
};

// Step 3: Branding
const StepBranding = ({ 
  data,
  onNext, 
  onSkip,
  onBack,
  logoUpload,
  bannerUpload,
  onLogoUpload,
  onBannerUpload
}: { 
  data: OnboardingData;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  logoUpload: ReturnType<typeof useFileUpload>;
  bannerUpload: ReturnType<typeof useFileUpload>;
  onLogoUpload: (files: File[]) => void;
  onBannerUpload: (files: File[]) => void;
}) => {
  return (
    <div className="py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="font-display font-bold text-display-sm text-foreground mb-2">
        Add your visual identity
      </h1>
      <p className="text-body text-muted-foreground mb-8">
        Upload your logo and branding to stand out.
      </p>

      <div className="space-y-8">
        <div>
          <label className="block mb-2 font-display font-medium text-body text-foreground">
            Profile Photo / Logo
          </label>
          <p className="text-sm text-muted-foreground mb-3">
            This appears on your public profile and next to your titles
          </p>
          <div className="max-w-xs">
            <FileUploadZone
              title="Upload logo"
              subtitle="Square image, min 200x200px"
              accept="image/*"
              onFilesSelected={onLogoUpload}
              isUploading={logoUpload.isUploading}
              uploadProgress={logoUpload.progress}
              uploadedUrl={data.logoUrl}
              error={logoUpload.error || undefined}
              onRemove={() => {}}
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 font-display font-medium text-body text-foreground">
            Banner Image (Optional)
          </label>
          <p className="text-sm text-muted-foreground mb-3">
            Wide image for your public profile header
          </p>
          <FileUploadZone
            title="Upload banner"
            subtitle="Recommended: 1200x400px"
            accept="image/*"
            onFilesSelected={onBannerUpload}
            isUploading={bannerUpload.isUploading}
            uploadProgress={bannerUpload.progress}
            uploadedUrl={data.bannerUrl}
            error={bannerUpload.error || undefined}
            onRemove={() => {}}
          />
        </div>

        {/* Preview Card */}
        {data.logoUrl && (
          <div className="bg-secondary/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Preview</p>
            <div className="flex items-center gap-3">
              <img 
                src={data.logoUrl} 
                alt="Logo preview" 
                className="w-12 h-12 rounded-full object-cover border-2 border-background"
              />
              <div>
                <p className="font-display font-semibold text-foreground">
                  {data.companyName || "Your Publication"}
                </p>
                <p className="text-sm text-muted-foreground">Publisher</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <ButtonPrimary onClick={onNext} className="flex-1">
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </ButtonPrimary>
        <button 
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
};

// Step 4: First Title
const StepFirstTitle = ({ 
  data, 
  setData, 
  onNext, 
  onSkip,
  onBack,
  coverUpload,
  onCoverUpload
}: { 
  data: OnboardingData; 
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  coverUpload: ReturnType<typeof useFileUpload>;
  onCoverUpload: (files: File[]) => void;
}) => {
  const updateTitle = (field: keyof OnboardingData["firstTitle"], value: string) => {
    setData(prev => ({
      ...prev,
      firstTitle: { ...prev.firstTitle, [field]: value }
    }));
  };

  const canSubmit = data.firstTitle.coverUrl && data.firstTitle.title && data.firstTitle.wholesalePrice && data.firstTitle.quantity;

  return (
    <div className="py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="font-display font-bold text-display-sm text-foreground mb-2">
        List your first magazine
      </h1>
      <p className="text-body text-muted-foreground mb-8">
        Add the essentials now — you can add more details later.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-display font-medium text-body text-foreground">
            Cover Image <span className="text-destructive">*</span>
          </label>
          <FileUploadZone
            title="Upload cover"
            subtitle="High-quality magazine cover"
            accept="image/*"
            onFilesSelected={onCoverUpload}
            isUploading={coverUpload.isUploading}
            uploadProgress={coverUpload.progress}
            uploadedUrl={data.firstTitle.coverUrl}
            error={coverUpload.error || undefined}
            onRemove={() => updateTitle("coverUrl", "")}
          />
        </div>

        <div className="space-y-4">
          <FormInput
            label="Title Name"
            required
            placeholder="e.g., Kinfolk Issue 45"
            value={data.firstTitle.title}
            onChange={(value) => updateTitle("title", value)}
          />

          <FormInput
            label="Issue Number"
            placeholder="e.g., Issue 45 or Vol. 12"
            value={data.firstTitle.issueNumber}
            onChange={(value) => updateTitle("issueNumber", value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Wholesale Price"
              required
              placeholder="$12.00"
              value={data.firstTitle.wholesalePrice}
              onChange={(value) => updateTitle("wholesalePrice", value)}
            />

            <FormInput
              label="Available Qty"
              required
              placeholder="50"
              value={data.firstTitle.quantity}
              onChange={(value) => updateTitle("quantity", value)}
            />
          </div>

          <FormTextarea
            label="Description (Optional)"
            placeholder="Brief description of this issue..."
            value={data.firstTitle.description}
            onChange={(value) => updateTitle("description", value)}
            rows={2}
          />
        </div>
      </div>

      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mt-6">
        <p className="text-sm text-accent">
          💡 You can add more details later. Just the basics to get started.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <ButtonPrimary onClick={onNext} disabled={!canSubmit} className="flex-1">
          Add Title
          <ChevronRight className="w-4 h-4 ml-2" />
        </ButtonPrimary>
        <button 
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
};

// Step 5: Payout Info
const StepPayout = ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => {
  return (
    <div className="py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="font-display font-bold text-display-sm text-foreground mb-2">
        How you get paid
      </h1>
      <p className="text-body text-muted-foreground mb-8">
        Here's how the payout process works on Neesh.
      </p>

      {/* Visual Flow */}
      <div className="flex items-center justify-between gap-2 mb-8 overflow-x-auto pb-2">
        <div className="flex flex-col items-center text-center min-w-[80px]">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">Order</span>
          <span className="text-xs text-muted-foreground">Received</span>
        </div>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        
        <div className="flex flex-col items-center text-center min-w-[80px]">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <CheckCircle className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">Delivery</span>
          <span className="text-xs text-muted-foreground">Confirmed</span>
        </div>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        
        <div className="flex flex-col items-center text-center min-w-[80px]">
          <div className="w-12 h-12 rounded-full bg-chart-green/20 flex items-center justify-center mb-2">
            <span className="text-chart-green font-bold">$</span>
          </div>
          <span className="text-xs font-medium text-foreground">Payout</span>
          <span className="text-xs text-muted-foreground">Processed</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <strong>Funds are held</strong> until delivery is confirmed by the retailer.
          </p>
        </div>
        
        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <strong>Payouts are processed monthly</strong> on the 15th of each month.
          </p>
        </div>
        
        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <strong>We'll collect your bank details</strong> via secure email before your first payout.
          </p>
        </div>
      </div>

      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mt-6">
        <p className="text-sm text-accent">
          📧 We'll email you to collect payout details before your first order ships
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <ButtonPrimary onClick={onNext} className="flex-1">
          Got it
          <ChevronRight className="w-4 h-4 ml-2" />
        </ButtonPrimary>
      </div>
    </div>
  );
};

// Step 6: Complete
const StepComplete = ({ onComplete }: { onComplete: () => void }) => {
  const navigate = useNavigate();
  
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-chart-green/20 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-chart-green" />
      </div>
      
      <h1 className="font-display font-bold text-display-md text-foreground mb-4">
        You're all set!
      </h1>
      
      <p className="text-body text-muted-foreground mb-8 max-w-md mx-auto">
        Your storefront is live. Retailers can now discover and order your titles.
      </p>

      <div className="grid gap-3 max-w-sm mx-auto mb-8">
        <button 
          onClick={() => navigate("/publisher/titles/new")}
          className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Add more titles</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <button 
          onClick={() => navigate("/publisher/profile")}
          className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <ExternalLink className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Complete your profile</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <button 
          onClick={() => {
            // TODO: Get actual public profile URL
            navigator.clipboard.writeText(window.location.origin + "/p/your-profile");
          }}
          className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Share your profile</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <ButtonPrimary onClick={onComplete} className="min-w-[200px]">
        Go to Dashboard
        <ArrowRight className="w-4 h-4 ml-2" />
      </ButtonPrimary>
    </div>
  );
};

export default PublisherOnboarding;
