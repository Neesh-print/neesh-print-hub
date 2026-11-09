import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { ChevronLeft, CheckCircle, ChevronRight, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ButtonPrimary, ButtonSecondary, FormInput, FormTextarea, FormSelect, FileUploadZone, Logo, AutoSaveIndicator } from "@/components/neesh";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { readFirstTouch, REFERRAL_SOURCES } from "@/lib/first-touch";
import { trackPublisherApplication } from "@/lib/neesh-analytics";
import {
  COUNTRIES,
  PUBLICATION_FREQUENCIES,
  DISTRIBUTION_REGIONS,
  FULFILLMENT_OPTIONS,
} from "@/lib/constants";
import { IntlMinimumNote } from "@/components/publisher/shipping/IntlMinimumNote";
import { isValidSubscribeUrl, normalizeSubscribeUrl } from "@/lib/subscribe-url";
import { buildPublisherSteps, SELL_FIELDS, type StepKey } from "@/lib/publisher-application-steps";


// The wizard keeps prices/quantities as strings so the inputs stay controlled;
// the DB columns are numeric, so blanks must become null rather than NaN.
const toNumberOrNull = (value: string | undefined): number | null => {
  const parsed = parseFloat((value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntOrNull = (value: string | undefined): number | null => {
  const parsed = parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

interface FormData {
  // Contact info (no password - account created on approval)
  firstName: string;
  lastName: string;
  email: string;
  // Who publishes it (company or studio)
  businessName: string;
  // The magazine itself (prefilled, and its step skipped, on a claim)
  magazineTitle: string;
  // Cover Image
  coverImageUrl: string;
  // Step 5: Description
  description: string;
  // Step 6: Online Presence
  websiteUrl: string;
  instagramHandle: string;
  // Optional. Kept in additional_info.subscribeUrl; a DB trigger copies it to
  // publisher_applications.subscribe_url and, once the claim links to an
  // Index title, onto directory_titles.subscribe_url.
  subscribeUrl: string;
  // "Do you want to sell on Neesh?" Null until answered; neither option is
  // preselected. Saved in additional_info.wantsToSell, which a DB trigger
  // mirrors to publisher_applications.wants_to_sell.
  wantsToSell: boolean | null;
  // Selling steps: Shipping Location
  shippingCountry: string;
  shipFromLine1: string;
  shipFromLine2: string;
  shippingCity: string;
  shippingState: string;
  shipFromPostalCode: string;
  shipFromPhone: string;
  // Step 8: Publication Details
  issueFrequency: string;
  publicationType: string;
  regionsCurrentlySold: string[];
  // Step 9: Pricing & Availability
  wholesalePrice: string;
  suggestedRetailPrice: string;
  availableQuantity: string;
  weightGrams: string;
  // Step 10: Fulfillment
  fulfillmentMethod: string;
  // Step 11: Additional Info
  cloudLink: string;
  // Confirmation. acceptTerms covers the marketplace terms (sellers);
  // acceptIndexTerms covers the Index Terms (claim only).
  confirmRights: boolean;
  acceptTerms: boolean;
  acceptIndexTerms: boolean;
  optInUpdates: boolean;
  referralSource: string;
  referralDetail: string;
}

// The publisher_applications row as get_publisher_application and the
// signed-in select return it. additional_info holds the whole wizard form.
interface PublisherApplicationDB {
  id: string;
  user_id: string | null;
  status: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  business_name: string | null;
  magazine_title: string | null;
  cover_image_url: string | null;
  description: string | null;
  social_website_link: string | null;
  instagram_handle: string | null;
  shipping_country: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  issue_frequency: string | null;
  publication_type: string | null;
  distribution_channels: string[] | null;
  wholesale_price: number | null;
  suggested_retail_price: number | null;
  available_quantity: number | null;
  fulfillment_method: string | null;
  quotes_feedback: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additional_info: Record<string, any> | null;
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
  subscribeUrl: "",
  wantsToSell: null,
  shippingCountry: "",
  shipFromLine1: "",
  shipFromLine2: "",
  shippingCity: "",
  shippingState: "",
  shipFromPostalCode: "",
  shipFromPhone: "",
  issueFrequency: "",
  publicationType: "",
  regionsCurrentlySold: [],
  wholesalePrice: "",
  suggestedRetailPrice: "",
  availableQuantity: "",
  weightGrams: "",
  fulfillmentMethod: "",
  cloudLink: "",
  confirmRights: false,
  acceptTerms: false,
  acceptIndexTerms: false,
  optInUpdates: true,
  referralSource: "",
  referralDetail: "",
};

export const PublisherApplication = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  // Set when the applicant arrived from a "Claim this profile" link on the
  // public index (?claim=<directory slug>). Persisted so it survives the
  // multi-step wizard and save-and-resume.
  const [claimSlug, setClaimSlug] = useState<string | null>(() =>
    localStorage.getItem("publisherClaimSlug")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [publisherId, setPublisherId] = useState<string | null>(() => localStorage.getItem('publisherAppId'));
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('publisherAccessToken'));
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // "Start selling on Neesh" from the portal: a signed-in claim-only
  // publisher, resuming at the selling question with the page steps filled.
  const [isSellUpgrade, setIsSellUpgrade] = useState(false);

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
    useServerValidation: false,
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

  const steps = buildPublisherSteps({
    skipTitle: !!claimSlug && !!formValues.magazineTitle,
    wantsToSell: formValues.wantsToSell,
  });
  const totalSteps = steps.length;
  const stepKey: StepKey | "success" = isSubmitted ? "success" : steps[currentStep - 1] ?? "contact";
  const sellStepNumber = steps.indexOf("sell") + 1;
  const isClaimOnly = formValues.wantsToSell === false;

  // Read the claim context handed over by the public index. The title (and
  // the Index publisher name, when the link carries it) prefill the form; the
  // slug rides along to submission so approval can mark that Index page
  // claimed for this account.
  useEffect(() => {
    const claim = searchParams.get("claim");
    const title = searchParams.get("title");
    const publisherName = searchParams.get("publisher");
    if (claim) {
      setClaimSlug(claim);
      localStorage.setItem("publisherClaimSlug", claim);
    }
    if (title && !getValues("magazineTitle")) {
      setValue("magazineTitle", title);
    }
    if (publisherName && !getValues("businessName")) {
      setValue("businessName", publisherName);
    }
  }, [searchParams, getValues, setValue]);

  // Check for existing draft applications to resume
  useEffect(() => {
    const checkForResume = async () => {
      // Wait for auth to initialize
      if (authLoading) return;

      // 1. Try to resume from Access Token (Anonymous)
      if (accessToken && publisherId) {
        try {
          const { data, error } = await supabase.rpc('get_publisher_application', {
            p_token: accessToken
          });

          if (data && !error) {
             const dbData = data as unknown as PublisherApplicationDB;

             // If the application was already submitted/approved, clear tokens and start fresh
             if (dbData.status === 'submitted' || dbData.status === 'approved') {
               localStorage.removeItem('publisherAppId');
               localStorage.removeItem('publisherAccessToken');
               setPublisherId(null);
               setAccessToken(null);
               setIsLoadingResume(false);
               return;
             }
             // Map DB snake_case to form camelCase
             // Map DB fields to form fields explicitly - don't spread additional_info
             // as it can override explicitly mapped fields and cause data leakage between fields
             const additionalInfo = dbData.additional_info || {};
             const formData: Partial<FormData> = {
                firstName: dbData.first_name || '',
                lastName: dbData.last_name || '',
                email: dbData.email || '',
                // Right after the contact step the draft holds only the name and
                // email; keep the title and publisher a claim link prefilled.
                businessName: dbData.business_name || getValues('businessName') || '',
                magazineTitle: dbData.magazine_title || getValues('magazineTitle') || '',
                coverImageUrl: dbData.cover_image_url || '',
                description: dbData.description || '',
                websiteUrl: dbData.social_website_link || additionalInfo.websiteUrl || '',
                instagramHandle: dbData.instagram_handle || '',
                subscribeUrl: additionalInfo.subscribeUrl || '',
                // Drafts started before the selling question existed resume
                // with it unanswered, so they're asked when they reach it.
                wantsToSell: typeof additionalInfo.wantsToSell === 'boolean' ? additionalInfo.wantsToSell : null,
                shippingCountry: dbData.shipping_country || '',
                shipFromLine1: additionalInfo.shipFromLine1 || '',
                shipFromLine2: additionalInfo.shipFromLine2 || '',
                shippingCity: dbData.shipping_city || '',
                shippingState: dbData.shipping_state || additionalInfo.shippingState || '',
                shipFromPostalCode: additionalInfo.shipFromPostalCode || '',
                shipFromPhone: additionalInfo.shipFromPhone || '',
                issueFrequency: dbData.issue_frequency || '',
                publicationType: dbData.publication_type || additionalInfo.publicationType || '',
                regionsCurrentlySold: dbData.distribution_channels || [],
                wholesalePrice: dbData.wholesale_price?.toString() || '',
                suggestedRetailPrice: dbData.suggested_retail_price?.toString() || '',
                availableQuantity: dbData.available_quantity?.toString() || '',
                weightGrams: additionalInfo.weightGrams || '',
                fulfillmentMethod: dbData.fulfillment_method || '',
                cloudLink: dbData.quotes_feedback || '',
                confirmRights: additionalInfo.confirmRights || false,
                acceptTerms: additionalInfo.acceptTerms || false,
                acceptIndexTerms: additionalInfo.acceptIndexTerms || false,
                optInUpdates: additionalInfo.optInUpdates ?? true,
                referralSource: additionalInfo.referralSource || '',
                referralDetail: additionalInfo.referralDetail || '',
             };
             
             console.log("Resuming application with data:", dbData);
             
             // Restore form state
             reset(formData as FormData);
             
             // Determine step based on data completeness
             const restoreStep = 2; // Default to after Step 1 if record exists
             /* 
             // Disable auto-advance for now to allow user to review all steps
             // and ensure data is actually present
             if (dbData.business_name) restoreStep = 3;
             if (dbData.magazine_title) restoreStep = 4;
             if (dbData.cover_image_url) restoreStep = 5;
             if (dbData.description) restoreStep = 6;
             if (dbData.shipping_country) restoreStep = 8; // Social links step 7 is optional?
             */
             
             setCurrentStep(restoreStep);
             setIsLoadingResume(false);
             return;
          } else {
            // Token didn't match any record - clear stale tokens
            console.warn("No matching application found for stored token, clearing");
            localStorage.removeItem('publisherAppId');
            localStorage.removeItem('publisherAccessToken');
            setPublisherId(null);
            setAccessToken(null);
          }
        } catch (err) {
           console.error("Resume error:", err);
           // If the token is invalid (400) or not found, we should clear it to prevent blocking the user
           localStorage.removeItem('publisherAppId');
           localStorage.removeItem('publisherAccessToken');
           setPublisherId(null);
           setAccessToken(null);
        }
      }

      // 2. For logged-in users, check their publisher status
      if (user) {
        try {
          const { data: publisher, error } = await supabase
            .from("publishers")
            .select("id, application_status, sells_on_neesh")
            .eq("user_id", user.id)
            .single();

          if (!error && publisher) {
            if (publisher.application_status === "approved") {
              // "Start selling on Neesh" from the portal.
              if (searchParams.get("sell") === "1" && publisher.sells_on_neesh === false) {
                const started = await startSellUpgrade(user.id, user.email ?? "");
                if (started) {
                  setIsLoadingResume(false);
                  return;
                }
              }
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
          }
           // If user has a draft in 'publishers', maybe we should fetch it?
           // Current architecture seems to split 'publisher_applications' (wizard) and 'publishers' (final).
           // If logged in, we rely on 'publishers' table status.
           // If we want to support resume for logged in users from 'publisher_applications', we'd need logic here.
           // For now, assuming logged in users might not use this specific anonymity flow or have different resume logic.
        } catch (err) {
          console.error("Error checking publisher status:", err);
        }
      }

      setIsLoadingResume(false);
    };

    checkForResume();
    // startSellUpgrade and searchParams are read once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, publisherId, accessToken, authLoading, reset]);

  // Opens a selling application for a signed-in claim-only publisher: reuses
  // their open draft if there is one, otherwise copies the page answers from
  // their approved claim into a new draft. Lands on the selling question.
  const startSellUpgrade = async (userId: string, email: string): Promise<boolean> => {
    try {
      const { data: rows } = await supabase
        .from("publisher_applications")
        .select("*")
        .or(`user_id.eq.${userId},email.eq.${email}`)
        .order("created_at", { ascending: false });
      const apps = (rows ?? []) as unknown as PublisherApplicationDB[];
      const openDraft = apps.find(
        (a) => a.status === "draft" && a.user_id === userId && a.additional_info?.sellUpgrade
      );
      const source = openDraft ?? apps.find((a) => a.status === "approved") ?? apps[0];
      if (!source) return false;
      const info = source.additional_info || {};

      let id = openDraft?.id ?? null;
      if (!id) {
        const { data: created, error: insertError } = await supabase
          .from("publisher_applications")
          .insert({
            user_id: userId,
            status: "draft",
            first_name: source.first_name,
            last_name: source.last_name,
            email: source.email || email,
            business_name: source.business_name,
            magazine_title: source.magazine_title,
            cover_image_url: source.cover_image_url,
            description: source.description,
            social_website_link: source.social_website_link,
            instagram_handle: source.instagram_handle,
            additional_info: {
              ...info,
              sellUpgrade: true,
              wantsToSell: null,
              ...(info.claimSlug ? { claimSlug: info.claimSlug } : {}),
            },
          })
          .select("id")
          .single();
        if (insertError || !created) throw insertError ?? new Error("No draft created");
        id = created.id;
      }

      reset({
        ...defaultFormValues,
        firstName: source.first_name || "",
        lastName: source.last_name || "",
        email: source.email || email,
        businessName: source.business_name || "",
        magazineTitle: source.magazine_title || "",
        coverImageUrl: source.cover_image_url || "",
        description: source.description || "",
        websiteUrl: source.social_website_link || info.websiteUrl || "",
        instagramHandle: source.instagram_handle || "",
        subscribeUrl: info.subscribeUrl || "",
        wantsToSell: openDraft && typeof info.wantsToSell === "boolean" ? info.wantsToSell : null,
      });
      setPublisherId(id);
      setIsSellUpgrade(true);
      // The page steps are already done; open at the selling question.
      const upgradeSteps = buildPublisherSteps({ skipTitle: false, wantsToSell: null });
      setCurrentStep(upgradeSteps.indexOf("sell") + 1);
      return true;
    } catch (err) {
      console.error("Could not start the selling application:", err);
      toast.error("We couldn't open the selling application. Please try again or email hi@neesh.art.");
      return false;
    }
  };

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
          shipping_state: mergedData.shippingState,
          issue_frequency: mergedData.issueFrequency,
          publication_type: mergedData.publicationType,
          distribution_channels: mergedData.regionsCurrentlySold,
          wholesale_price: toNumberOrNull(mergedData.wholesalePrice),
          suggested_retail_price: toNumberOrNull(mergedData.suggestedRetailPrice),
          available_quantity: toIntOrNull(mergedData.availableQuantity),
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
        
        console.log("Saving progress RPC:", { publisherId, data: mergedData });

        const { error: rpcError } = await supabase.rpc('update_publisher_application', {
           p_id: publisherId,
           p_token: accessToken,
           p_data: mergedData
        });
        
        if (rpcError) {
          console.error("Save Progress RPC Error:", rpcError);
          throw rpcError;
        }
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

    } catch (err: unknown) {
      console.error("Error saving basic info:", err);
      toast.error((err instanceof Error ? err.message : "Failed to save information. Please try again."));
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    switch (stepKey) {
      case "contact":
        return await trigger(["firstName", "lastName", "email"]);
      case "title":
        return await trigger("magazineTitle");
      case "business":
        return await trigger("businessName");
      case "cover":
        return !!formValues.coverImageUrl;
      case "description":
        return await trigger("description");
      case "online":
        return !!(formValues.websiteUrl || formValues.instagramHandle) && await trigger("subscribeUrl");
      case "sell":
        return formValues.wantsToSell !== null;
      case "shipping":
        return await trigger(["shippingCountry", "shipFromLine1", "shippingCity", "shippingState", "shipFromPostalCode"]);
      case "pricing":
        return await trigger(["wholesalePrice", "suggestedRetailPrice", "availableQuantity", "weightGrams"]);
      case "confirm":
        return formValues.confirmRights && formValues.acceptTerms;
      case "claimConfirm":
        return formValues.confirmRights && formValues.acceptIndexTerms;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    // The contact step creates the draft application.
    if (stepKey === "contact" && !publisherId) {
      await handleSaveBasicInfo();
      return;
    }

    const isValid = await validateCurrentStep();

    if (!isValid) {
      if (stepKey === "cover" && !formValues.coverImageUrl) {
        toast.error("Please upload a cover image");
        return;
      }
      if (stepKey === "online" && !formValues.websiteUrl && !formValues.instagramHandle) {
        toast.error("Please provide either a website or Instagram handle");
        return;
      }
      if (stepKey === "sell") {
        toast.error("Choose whether you want to sell on Neesh. Your claim goes through either way.");
        return;
      }
      return; // trigger() handles field errors
    }

    // Store the subscription link as a full URL (bare domains get https://).
    if (stepKey === "online") {
      const subscribeUrl = normalizeSubscribeUrl(getValues("subscribeUrl"));
      setValue("subscribeUrl", subscribeUrl);
      await saveProgress({ subscribeUrl });
    } else {
      // Save progress before moving to next step
      await saveProgress();
    }

    // A claim-only publisher who opened "Start selling" and then said not
    // right now: nothing to submit, back to the dashboard.
    if (stepKey === "sell" && isSellUpgrade && formValues.wantsToSell === false) {
      toast.success("No problem. You can start selling any time from your dashboard.");
      navigate("/publisher");
      return;
    }

    // steps already reflects the selling answer, so this lands on the first
    // selling step or on the claim confirmation.
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  // The first step after contact (or, when starting to sell from the portal,
  // the selling question's own page steps) is as far back as you can go once
  // the draft exists.
  const canGoBack = currentStep > 1 && !(steps[currentStep - 2] === "contact" && publisherId);

  const handleBack = () => {
    if (canGoBack) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveAndExit = async () => {
    await saveProgress();
    toast.success("Progress saved! You can resume anytime.");
    navigate(isSellUpgrade ? "/publisher" : "/");
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      stepKey !== "additional" &&
      stepKey !== "confirm" &&
      stepKey !== "claimConfirm" &&
      stepKey !== "success"
    ) {
      e.preventDefault();
      handleNext();
    }
  }, [stepKey, handleNext]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = async () => {
    const claimOnly = formValues.wantsToSell === false;

    if (formValues.wantsToSell === null) {
      toast.error("Choose whether you want to sell on Neesh first.");
      return;
    }

    if (!formValues.confirmRights) {
      toast.error(claimOnly
        ? "Please confirm you publish this title or are authorized to represent it"
        : "Please confirm you have distribution rights");
      return;
    }

    if (claimOnly ? !formValues.acceptIndexTerms : !formValues.acceptTerms) {
      toast.error(claimOnly
        ? "Please accept the Terms of Service and Index Terms"
        : "Please accept the Terms of Service and Publisher Agreement");
      return;
    }

    if (!formValues.referralSource) {
      toast.error("Let us know how you heard about Neesh");
      return;
    }

    if (!publisherId) {
      toast.error("Session error. Please refresh and try again.");
      return;
    }

    setIsSubmitting(true);
    const firstTouch = readFirstTouch();

    // A claim-only submission carries none of the selling answers, even if
    // the applicant filled some in before going back and choosing claim only.
    const formForSubmission: Record<string, unknown> = { ...formValues };
    if (claimOnly) {
      for (const field of SELL_FIELDS) delete formForSubmission[field];
    } else {
      delete formForSubmission.acceptIndexTerms;
    }

    try {
      const submissionData = {
        first_name: formValues.firstName,
        last_name: formValues.lastName,
        email: formValues.email,
        business_name: formValues.businessName,
        magazine_title: formValues.magazineTitle,
        cover_image_url: formValues.coverImageUrl,
        description: formValues.description,
        social_website_link: formValues.websiteUrl || formValues.instagramHandle,
        instagram_handle: formValues.instagramHandle?.replace("@", ""),
        shipping_country: claimOnly ? null : formValues.shippingCountry,
        shipping_city: claimOnly ? null : formValues.shippingCity,
        shipping_state: claimOnly ? null : formValues.shippingState,
        issue_frequency: claimOnly ? null : formValues.issueFrequency,
        publication_type: claimOnly ? null : formValues.publicationType,
        distribution_channels: claimOnly ? [] : formValues.regionsCurrentlySold,
        wholesale_price: claimOnly ? null : toNumberOrNull(formValues.wholesalePrice),
        suggested_retail_price: claimOnly ? null : toNumberOrNull(formValues.suggestedRetailPrice),
        available_quantity: claimOnly ? null : toIntOrNull(formValues.availableQuantity),
        fulfillment_method: claimOnly ? null : formValues.fulfillmentMethod,
        quotes_feedback: claimOnly ? null : formValues.cloudLink,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        additional_info: {
          ...formForSubmission,
          wantsToSell: !claimOnly,
          subscribeUrl: normalizeSubscribeUrl(formValues.subscribeUrl),
          ...(claimSlug ? { claimSlug } : {}),
          ...(isSellUpgrade ? { sellUpgrade: true } : {}),
          ...(firstTouch ? { firstTouch } : {}),
          acceptedTermsAt: new Date().toISOString(),
          acceptedTermsKind: claimOnly ? "index" : "marketplace",
        },
      };

      if (user) {
        // Authenticated users: Update directly
        const { error: appError } = await supabase
          .from("publisher_applications")
          .update(submissionData)
          .eq("id", publisherId);

        if (appError) throw appError;
      } else {
        // Anonymous users: Use secure RPC
        if (!accessToken) throw new Error("No access token found");

        // The RPC expects camelCase keys matching the form. It keeps earlier
        // values for blank fields, so a claim-only submission can't clear
        // selling answers saved before; approval ignores them for claim only.
        const rpcData = {
          firstName: submissionData.first_name,
          lastName: submissionData.last_name,
          email: submissionData.email,
          businessName: submissionData.business_name,
          magazineTitle: submissionData.magazine_title,
          coverImageUrl: submissionData.cover_image_url,
          description: submissionData.description,
          websiteUrl: formValues.websiteUrl, // use original form values for consistent casing
          instagramHandle: formValues.instagramHandle,
          ...(claimOnly
            ? {}
            : {
                shippingCountry: submissionData.shipping_country,
                shippingCity: submissionData.shipping_city,
                issueFrequency: submissionData.issue_frequency,
                publicationType: submissionData.publication_type,
                regionsCurrentlySold: submissionData.distribution_channels,
                wholesalePrice: formValues.wholesalePrice,
                suggestedRetailPrice: formValues.suggestedRetailPrice,
                availableQuantity: formValues.availableQuantity,
                fulfillmentMethod: submissionData.fulfillment_method,
                cloudLink: submissionData.quotes_feedback,
              }),
          status: 'submitted',
          ...submissionData.additional_info
        };

        const { error: rpcError } = await supabase.rpc('update_publisher_application', {
             p_id: publisherId,
             p_token: accessToken,
             p_data: rpcData
        });

        if (rpcError) {
          console.error("RPC Error details:", rpcError);
          throw rpcError;
        }
      }

      setIsSubmitted(true);
      trackPublisherApplication(formValues.referralSource);
      localStorage.removeItem('publisherClaimSlug');

      // Send application received confirmation email (fire and forget).
      // claimTitle switches the email to the claim-received wording;
      // claimOnly says nothing about selling.
      try {
        // functions.invoke sends the Authorization header the function's
        // JWT check needs. The raw fetch only sent `apikey`, so every call
        // was rejected with 401 UNAUTHORIZED_NO_AUTH_HEADER and applicants
        // never got this email.
        const { error: emailError } = await supabase.functions.invoke(
          'send-application-received-email',
          {
            body: {
              email: formValues.email,
              firstName: formValues.firstName,
              businessName: formValues.businessName || formValues.magazineTitle,
              role: 'publisher',
              ...(claimSlug || claimOnly
                ? { claimTitle: formValues.magazineTitle || claimSlug }
                : {}),
              ...(claimOnly ? { claimOnly: true } : {}),
              ...(isSellUpgrade ? { sellUpgrade: true } : {}),
            },
          }
        );
        if (emailError) console.error('Failed to send confirmation email:', emailError);
      } catch (emailError) {
        // Don't fail the submission if email fails
        console.error('Failed to send confirmation email:', emailError);
      }

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
    switch (stepKey) {
      case "contact":
        // If already have publisher ID (started application), skip to step 2
        if (publisherId) {
          setCurrentStep(2);
          return null;
        }
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                {claimSlug && formValues.magazineTitle
                  ? `Claim ${formValues.magazineTitle}`
                  : "Put your magazine on the Neesh Index"}
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto mt-4">
                Takes about 3 minutes.
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
              We check every claim by hand. Once it&rsquo;s approved we&rsquo;ll email you a link to sign in.
            </p>
          </div>
        );

      case "business":
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Who publishes {formValues.magazineTitle || "it"}?
            </h1>
            <Controller
              name="businessName"
              control={control}
              rules={{ required: "Add who publishes it" }}
              render={({ field }) => (
                <FormInput
                  label="Publisher or company name"
                  placeholder="e.g., Ouur Media, Pocko Editions"
                  helperText="Your company or studio. Often the same as the magazine's name."
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

      case "title":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                What&rsquo;s your magazine called?
              </h1>
              <p className="text-muted-foreground mt-2">
                Start with one. You can add more later.
              </p>
            </div>
            <Controller
              name="magazineTitle"
              control={control}
              rules={{ required: "Add your magazine's name" }}
              render={({ field }) => (
                <FormInput
                  label="Magazine name"
                  placeholder="e.g., Kinfolk, Apartamento"
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

      case "cover":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Show us your magazine
              </h1>
              <p className="text-muted-foreground mt-2">
                Upload a cover image so we can see your work.
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

      case "description":
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Tell us about {formValues.magazineTitle || "your magazine"}
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
                  helperText="2–3 sentences is perfect."
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

      case "online":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Where can we find you online?
              </h1>
              <p className="text-muted-foreground mt-2">
                We use this to check the magazine is yours.
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
                    autoComplete="off"
                    name="publisher-instagram"
                  />
                )}
              />
              <Controller
                name="subscribeUrl"
                control={control}
                rules={{
                  validate: (value) =>
                    isValidSubscribeUrl(value) || "Please enter a link that starts with http:// or https://",
                }}
                render={({ field }) => (
                  <FormInput
                    id="publisher-subscribe-url"
                    label="Subscription link"
                    inputMode="url"
                    placeholder="https://yourmagazine.com/subscribe"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={() => field.onChange(normalizeSubscribeUrl(field.value))}
                    error={errors.subscribeUrl?.message}
                    helperText="Where readers can subscribe. We'll link to it from your Index page."
                    autoComplete="off"
                  />
                )}
              />
              {!formValues.websiteUrl && !formValues.instagramHandle && (
                <p className="text-sm text-destructive">
                  A website or an Instagram handle — either one works.
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

      case "sell":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Do you want to sell on Neesh?
              </h1>
              {!isSellUpgrade && (
                <p className="text-muted-foreground mt-3">
                  Your claim goes through either way. Claiming gives you your page on the Neesh
                  Index. You can edit it, keep your issues up to date, and see who&rsquo;s looking.
                </p>
              )}
              <p className="text-muted-foreground mt-3">
                Selling is a separate choice. If you sell on Neesh, shops, caf&eacute;s and hotels
                can order copies from you at the wholesale price you set. Neesh takes 10% of
                wholesale on each order. You ship, and you&rsquo;re paid through Stripe once the
                order ships.
              </p>
              <p className="text-muted-foreground mt-3">
                {isSellUpgrade
                  ? "Selling adds six short steps, then a person reviews it."
                  : "You can start selling any time from your dashboard."}
              </p>
            </div>
            <div className="space-y-3" role="radiogroup" aria-label="Do you want to sell on Neesh?">
              {[
                {
                  value: true,
                  label: "Yes, I want to sell on Neesh",
                  hint: "Six more steps: shipping, details, pricing, fulfillment, anything else, and terms.",
                },
                {
                  value: false,
                  label: isSellUpgrade ? "Not right now" : "Not right now, just claim my page",
                  hint: isSellUpgrade
                    ? "Back to your dashboard. Your page stays as it is."
                    : "One more step: confirm the title is yours, then submit.",
                },
              ].map((option) => {
                const selected = formValues.wantsToSell === option.value;
                return (
                  <label
                    key={String(option.value)}
                    className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selected ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="wantsToSell"
                      checked={selected}
                      onChange={() => setValue("wantsToSell", option.value)}
                      className="sr-only"
                    />
                    <span className="font-medium text-foreground">{option.label}</span>
                    <p className="text-sm text-muted-foreground mt-1">{option.hint}</p>
                  </label>
                );
              })}
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth disabled={formValues.wantsToSell === null}>
              Continue
            </ButtonPrimary>
          </div>
        );

      case "shipping":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Where will you ship from?
              </h1>
              <p className="text-muted-foreground mt-2">
                The address your orders leave from. We use it for shipping quotes and labels.
              </p>
            </div>
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
                    autoComplete="off"
                    required
                  />
                )}
              />
              {formValues.shippingCountry && formValues.shippingCountry !== "US" && formValues.shippingCountry !== "OTHER" && (
                <IntlMinimumNote country={formValues.shippingCountry} />
              )}
              <Controller
                name="shipFromLine1"
                control={control}
                rules={{ required: "Street address is required" }}
                render={({ field }) => (
                  <FormInput
                    label="Street Address"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.shipFromLine1?.message}
                    autoComplete="off"
                    name="publisher-ship-from-line1"
                    required
                  />
                )}
              />
              <Controller
                name="shipFromLine2"
                control={control}
                render={({ field }) => (
                  <FormInput
                    label="Apt / Suite (optional)"
                    value={field.value}
                    onChange={field.onChange}
                    autoComplete="off"
                    name="publisher-ship-from-line2"
                  />
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="shippingCity"
                  control={control}
                  rules={{ required: "City is required" }}
                  render={({ field }) => (
                    <FormInput
                      label="City"
                      placeholder="e.g., Los Angeles, London"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.shippingCity?.message}
                      autoComplete="off"
                      name="publisher-shipping-city"
                      required
                    />
                  )}
                />
                <Controller
                  name="shipFromPostalCode"
                  control={control}
                  rules={{ required: "Postal code is required" }}
                  render={({ field }) => (
                    <FormInput
                      label="Postal Code"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.shipFromPostalCode?.message}
                      autoComplete="off"
                      name="publisher-ship-from-postal"
                      required
                    />
                  )}
                />
              </div>
              {(formValues.shippingCountry === "US" || formValues.shippingCountry === "CA") && (
                <Controller
                  name="shippingState"
                  control={control}
                  rules={{
                    validate: (v) =>
                      !["US", "CA"].includes(getValues("shippingCountry")) || !!v?.trim() ||
                      (getValues("shippingCountry") === "CA" ? "Province is required" : "State is required"),
                  }}
                  render={({ field }) => (
                    <FormInput
                      label={formValues.shippingCountry === "CA" ? "Province" : "State"}
                      placeholder={formValues.shippingCountry === "CA" ? "ON" : "NY"}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.shippingState?.message}
                      autoComplete="off"
                      name="publisher-ship-from-state"
                      required
                    />
                  )}
                />
              )}
              <Controller
                name="shipFromPhone"
                control={control}
                render={({ field }) => (
                  <FormInput
                    label="Phone"
                    type="tel"
                    value={field.value}
                    onChange={field.onChange}
                    autoComplete="off"
                    name="publisher-ship-from-phone"
                    helperText="Carriers need it for labels and customs."
                  />
                )}
              />
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case "details":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                A few more details
              </h1>
              <p className="text-muted-foreground mt-2">
                Optional, but it helps us understand your publication.
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

      case "pricing":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Pricing and availability
              </h1>
              <p className="text-muted-foreground mt-2">
                Retailers buy at your wholesale price. You can change these later.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  name="wholesalePrice"
                  control={control}
                  rules={{
                    required: "Add your wholesale price.",
                    pattern: {
                      value: /^\d+(\.\d{1,2})?$/,
                      message: "Enter an amount like 12 or 12.50.",
                    },
                    validate: (value) =>
                      parseFloat(value) > 0 || "Wholesale price must be more than 0.",
                  }}
                  render={({ field }) => (
                    <FormInput
                      id="wholesalePrice"
                      label="Wholesale price per copy (USD)"
                      inputMode="decimal"
                      placeholder="12.00"
                      error={errors.wholesalePrice?.message}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="suggestedRetailPrice"
                  control={control}
                  rules={{
                    required: "Add a suggested retail price.",
                    pattern: {
                      value: /^\d+(\.\d{1,2})?$/,
                      message: "Enter an amount like 20 or 19.99.",
                    },
                    validate: (value) => {
                      const retail = parseFloat(value);
                      if (!(retail > 0)) return "Retail price must be more than 0.";
                      const wholesale = parseFloat(getValues("wholesalePrice"));
                      if (!isNaN(wholesale) && retail < wholesale) {
                        return "Retail price should be at least the wholesale price.";
                      }
                      return true;
                    },
                  }}
                  render={({ field }) => (
                    <FormInput
                      id="suggestedRetailPrice"
                      label="Suggested retail price (USD)"
                      inputMode="decimal"
                      placeholder="20.00"
                      error={errors.suggestedRetailPrice?.message}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              <Controller
                name="availableQuantity"
                control={control}
                rules={{
                  required: "Add how many copies you have available.",
                  pattern: {
                    value: /^\d+$/,
                    message: "Enter a whole number of copies.",
                  },
                  validate: (value) =>
                    parseInt(value, 10) > 0 || "You need at least 1 copy available.",
                }}
                render={({ field }) => (
                  <FormInput
                    id="availableQuantity"
                    label="Copies available"
                    inputMode="numeric"
                    placeholder="100"
                    helperText="How many copies of this issue you can supply."
                    error={errors.availableQuantity?.message}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="weightGrams"
                control={control}
                rules={{
                  required: "Add the weight of one copy.",
                  pattern: {
                    value: /^\d+(\.\d+)?$/,
                    message: "Enter grams, like 350.",
                  },
                  validate: (value) =>
                    parseFloat(value) > 0 || "Weight must be more than 0.",
                }}
                render={({ field }) => (
                  <FormInput
                    id="weightGrams"
                    label="Weight of one copy (grams)"
                    inputMode="numeric"
                    placeholder="350"
                    helperText="Spaces see live shipping based on it."
                    error={errors.weightGrams?.message}
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

      case "fulfillment":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                How would you like to ship orders?
              </h1>
              <p className="text-muted-foreground mt-2">
                You can change this later.
              </p>
            </div>
            <div className="space-y-3">
              {FULFILLMENT_OPTIONS.map((option) => {
                const isDisabled = 'disabled' in option && option.disabled;
                const isComingSoon = 'comingSoon' in option && option.comingSoon;
                return (
                <label
                  key={option.value}
                  className={`
                    block p-4 rounded-lg border-2 transition-all
                    ${isDisabled 
                      ? "border-border bg-muted/50 cursor-not-allowed opacity-60" 
                      : "cursor-pointer hover:border-accent/50"
                    }
                    ${!isDisabled && formValues.fulfillmentMethod === option.value
                      ? "border-accent bg-accent/5"
                      : "border-border"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value={option.value}
                    checked={formValues.fulfillmentMethod === option.value}
                    onChange={(e) => !isDisabled && setValue("fulfillmentMethod", e.target.value)}
                    disabled={isDisabled}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isDisabled ? "text-muted-foreground" : "text-foreground"}`}>
                      {option.label}
                    </span>
                    {isComingSoon && (
                      <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                </label>
              );
              })}
            </div>
            <ButtonPrimary onClick={handleNext} fullWidth>
              Continue
            </ButtonPrimary>
          </div>
        );

      case "additional":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Anything else to share?
              </h1>
              <p className="text-muted-foreground mt-2">
                Optional — link to a press kit, media folder, or additional images.
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

      case "confirm":
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Almost done
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
              <FormSelect
                label="How did you hear about Neesh?"
                placeholder="Pick the closest answer"
                options={REFERRAL_SOURCES.map(s => ({ value: s.value, label: s.label }))}
                value={formValues.referralSource}
                onChange={(value) => setValue("referralSource", value)}
                required
              />
              <FormInput
                label="Anything more specific? (optional)"
                placeholder="The magazine, shop, post or person"
                value={formValues.referralDetail}
                onChange={(value) => setValue("referralDetail", value.slice(0, 200))}
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.confirmRights}
                  onCheckedChange={(checked) => setValue("confirmRights", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  I confirm I have the rights to distribute this publication. <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.acceptTerms}
                  onCheckedChange={(checked) => setValue("acceptTerms", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  I agree to the{" "}
                  <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">Terms of Service</a>,{" "}
                  <a href="/legal/publisher-agreement" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">Publisher Agreement</a>, and{" "}
                  <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">Privacy Policy</a>{" "}
                  <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.optInUpdates}
                  onCheckedChange={(checked) => setValue("optInUpdates", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  I'd like to receive platform updates and publisher insights
                </span>
              </label>
            </div>

            <ButtonPrimary
              onClick={handleSubmit}
              fullWidth
              loading={isSubmitting}
              disabled={!formValues.confirmRights || !formValues.acceptTerms || !formValues.referralSource}
            >
              Submit Application
            </ButtonPrimary>
          </div>
        );

      case "claimConfirm":
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Confirm your claim
              </h1>
              <p className="text-muted-foreground mt-2">
                No pricing, stock or shipping needed. A person checks it, usually within a day.
              </p>
            </div>

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
                  <p className="font-medium text-foreground">{formValues.magazineTitle}</p>
                  <p className="text-sm text-muted-foreground">Published by {formValues.businessName}</p>
                  <p className="text-sm text-muted-foreground mt-2">{formValues.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <FormSelect
                label="How did you hear about Neesh?"
                placeholder="Pick the closest answer"
                options={REFERRAL_SOURCES.map(s => ({ value: s.value, label: s.label }))}
                value={formValues.referralSource}
                onChange={(value) => setValue("referralSource", value)}
                required
              />
              <FormInput
                label="Anything more specific? (optional)"
                placeholder="The magazine, shop, post or person"
                value={formValues.referralDetail}
                onChange={(value) => setValue("referralDetail", value.slice(0, 200))}
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.confirmRights}
                  onCheckedChange={(checked) => setValue("confirmRights", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  I publish {formValues.magazineTitle || "this title"} or am authorized to represent it. <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.acceptIndexTerms}
                  onCheckedChange={(checked) => setValue("acceptIndexTerms", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  I agree to the{" "}
                  <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">Terms of Service</a>,{" "}
                  <a href="/legal/index-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">Index Terms</a>, and{" "}
                  <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">Privacy Policy</a>{" "}
                  <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formValues.optInUpdates}
                  onCheckedChange={(checked) => setValue("optInUpdates", !!checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  I&rsquo;d like to receive platform updates and publisher insights
                </span>
              </label>
            </div>

            <ButtonPrimary
              onClick={handleSubmit}
              fullWidth
              loading={isSubmitting}
              disabled={!formValues.confirmRights || !formValues.acceptIndexTerms || !formValues.referralSource}
            >
              Submit claim
            </ButtonPrimary>
          </div>
        );

      case "success":
        return (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              That&rsquo;s with us now.
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              {isClaimOnly ? (
                <>
                  We check every claim by hand, usually within a day. Once it&rsquo;s approved
                  we&rsquo;ll email{" "}
                  <span className="font-medium text-foreground">{formValues.email}</span>{" "}
                  a link to edit your page. No password needed.
                </>
              ) : isSellUpgrade ? (
                <>
                  We review every selling application by hand. Expect to hear back at{" "}
                  <span className="font-medium text-foreground">{formValues.email}</span>{" "}
                  within a few days. Your page stays as it is in the meantime.
                </>
              ) : (
                <>
                  We review every application by hand. Expect to hear back at{" "}
                  <span className="font-medium text-foreground">{formValues.email}</span>{" "}
                  within a few days. Once you&rsquo;re approved we&rsquo;ll email you a link to sign in.
                </>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Questions? Reach out to{" "}
              <a href="mailto:hi@neesh.art" className="text-accent hover:underline">
                hi@neesh.art
              </a>
            </p>
            <div className="pt-4">
              <ButtonSecondary onClick={() => navigate(isSellUpgrade ? "/publisher" : "/")} className="min-w-[200px]">
                {isSellUpgrade ? "Back to dashboard" : "Back to Home"}
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

          {/* Progress indicator. The total follows the path: the claim path
              until the selling question is answered yes. The success screen
              shows no step chrome. */}
          {stepKey !== "success" && (
            <span className="font-mono text-xs uppercase tracking-[0.1em] text-[#71747F] text-center">
              {claimSlug && formValues.magazineTitle && !isSellUpgrade && (
                <span className="block sm:inline text-foreground">
                  Claim {formValues.magazineTitle}
                  <span className="hidden sm:inline text-[#71747F]"> &middot; </span>
                </span>
              )}
              {isSellUpgrade && (
                <span className="block sm:inline text-foreground">
                  Start selling
                  <span className="hidden sm:inline text-[#71747F]"> &middot; </span>
                </span>
              )}
              Step {currentStep} of {totalSteps}
            </span>
          )}

          <div className="flex items-center gap-4">
            {/* Auto-save indicator */}
            {publisherId && currentStep > 1 && stepKey !== "confirm" && stepKey !== "claimConfirm" && stepKey !== "success" && (
              <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />
            )}

            {/* Save & Exit button */}
            {publisherId && currentStep > 1 && stepKey !== "confirm" && stepKey !== "claimConfirm" && stepKey !== "success" && (
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

        {/* Progress bar */}
        {stepKey !== "success" && (
          <div className="h-0.5 bg-[#EFEEF6]">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Back button */}
      {stepKey !== "success" && canGoBack && (
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


          {/* Form content */}
          <form 
            className="flex-1 max-w-md mx-auto" 
            autoComplete="off" 
            onSubmit={(e) => e.preventDefault()}
            data-lpignore="true"
          >
            {/* Progress card - Mobile only (removed, using header bar) */}

            {claimSlug && !isSubmitted && !isSellUpgrade && currentStep < sellStepNumber && (
              <div className="mb-6 p-4 rounded-lg border border-accent/40 bg-accent/5 text-sm text-foreground">
                You&apos;re claiming{" "}
                <strong>{formValues.magazineTitle || "your title"}</strong> from the
                Neesh Index.
              </div>
            )}

            {/* key={currentStep} forces React to fully unmount/remount DOM nodes
                between steps. Without this, React reuses <input> DOM nodes across
                steps (same tree position), and browser autofill carries values
                from one step's inputs into the next (e.g., Instagram → City). */}
            <div key={currentStep}>
              {renderStep()}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default PublisherApplication;
