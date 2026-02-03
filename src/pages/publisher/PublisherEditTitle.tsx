import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, FormInput, FormTextarea, FileUploadZone, ButtonPrimary } from "@/components/neesh";
import { FormSelect } from "@/components/neesh/FormSelect";
import { useFileUpload } from "@/hooks/useFileUpload";
import { CountrySelect } from "@/components/ui/country-select";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryOptions } from "@/lib/categories";

export const PublisherEditTitle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  
  // Generate a unique storage key for this form
  const storageKey = `publisher-edit-title-${id || 'new'}`;

  // Form state with localStorage persistence
  const getInitialFormData = () => {
    // Try to load from localStorage first
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved form data:', e);
      }
    }
    
    // Default form data
    // Default initial form state
    return {
      title: "",
      issueNumber: "",
      frequency: "",
      isSingleIssue: true,
      isSeries: false,
      category: "",
      subcategory: "",
      widthMm: "",
      heightMm: "",
      weightGrams: "",
      pageCount: "",
      printRun: "",
      warehouseLocation: "",
      availableQuantities: "",
      restockTimeline: "",
      descriptiveText: "",
      isbn: "",
      metadata: "",
      wholesalePrice: "",
      retailPrice: "",
      discountStructure: "",
      paymentTerms: "",
      originCountryCode: null as string | null,
      publicationDate: null as string | null,
      fulfillmentMethod: "publisher_handled",
      minimumOrderQuantity: "1",
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  // We need a ref to track if we've already loaded the initial data to prevent overwriting user edits
  // if this component re-renders or if we use local storage.
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch magazine data if editing
  useEffect(() => {
    if (isNew) return;

    const fetchMagazine = async () => {
      try {
        const { data, error } = await supabase
          .from('magazines')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          // Only update if we haven't loaded yet, or strictly rely on this fetch being the source of truth
          // for the initial edit state.
          // Note: LocalStorage might have draft edits. We should decide precedence. 
          // For now, let's trust the DB if it's the first load, but maybe warn if local storage exists?
          // Actually, let's keep it simple: DB data overrides unless local storage is VERY fresh (not implemented).
          // We'll just load DB data.
          
          setFormData({
            title: data.title || "",
            issueNumber: data.issue_number || "",
            frequency: data.issue_frequency || "",
            isSingleIssue: data.publication_type === 'Issue',
            isSeries: data.publication_type !== 'Issue',
            category: data.category || "",
            subcategory: data.subcategory || "",
            widthMm: data.width_mm?.toString() || "",
            heightMm: data.height_mm?.toString() || "",
            weightGrams: data.weight_grams?.toString() || "",
            pageCount: data.page_count?.toString() || "",
            printRun: data.print_run || "",
            warehouseLocation: data.warehouse_location || "",
            availableQuantities: data.inventory_count?.toString() || "",
            restockTimeline: data.restock_timeline || "",
            descriptiveText: data.description || "",
            isbn: data.isbn || "",
            metadata: data.metadata || "",
            wholesalePrice: data.wholesale_price?.toString() || "",
            retailPrice: data.suggested_retail_price?.toString() || "",
            discountStructure: data.discount_structure || "",
            paymentTerms: data.payment_terms || "",
            originCountryCode: data.origin_country_code || null,
            publicationDate: data.publication_date || null,
            fulfillmentMethod: data.fulfillment_method || "publisher_handled",
            minimumOrderQuantity: data.minimum_order_quantity?.toString() || "1",
          });

          // Set images
          setCoverImageUrl(data.cover_image_url);
          setSampleSpreadUrl(data.sample_spread_url);
          setLogoUrl(data.logo_url);
        }
      } catch (err) {
        console.error("Error fetching magazine:", err);
        toast.error("Failed to load magazine details.");
      }
    };

    fetchMagazine();
  }, [id, isNew]);
  
  // Auto-save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(formData));
  }, [formData, storageKey]);

  // Uploaded image URLs (also persisted)
  const getInitialImageUrls = () => {
    const saved = localStorage.getItem(`${storageKey}-images`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { cover: null, spread: null, logo: null };
      }
    }
    return { cover: null, spread: null, logo: null };
  };
  
  const initialImages = getInitialImageUrls();
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialImages.cover);
  const [sampleSpreadUrl, setSampleSpreadUrl] = useState<string | null>(initialImages.spread);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialImages.logo);
  
  // Auto-save image URLs
  useEffect(() => {
    localStorage.setItem(`${storageKey}-images`, JSON.stringify({
      cover: coverImageUrl,
      spread: sampleSpreadUrl,
      logo: logoUrl,
    }));
  }, [coverImageUrl, sampleSpreadUrl, logoUrl, storageKey]);

  // File upload hooks
  const coverUpload = useFileUpload({
    bucket: 'magazine-assets',
    folder: 'covers',
    maxSizeMB: 10, // Covers can be larger
    onUploadComplete: (url) => {
      setCoverImageUrl(url);
      toast.success("Cover image uploaded successfully");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const spreadUpload = useFileUpload({
    bucket: 'magazine-assets',
    folder: 'spreads',
    maxSizeMB: 10,
    onUploadComplete: (url) => {
      setSampleSpreadUrl(url);
      toast.success("Sample spread uploaded successfully");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const logoUpload = useFileUpload({
    bucket: 'magazine-assets',
    folder: 'logos',
    maxSizeMB: 2,
    onUploadComplete: (url) => {
      setLogoUrl(url);
      toast.success("Logo uploaded successfully");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleInputChange = (field: string) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.checked }));
  };

  const handleCoverUpload = (files: File[]) => {
    if (files[0]) {
      coverUpload.upload(files[0]);
    }
  };

  const handleSpreadUpload = (files: File[]) => {
    if (files[0]) {
      spreadUpload.upload(files[0]);
    }
  };

  const handleLogoUpload = (files: File[]) => {
    if (files[0]) {
      logoUpload.upload(files[0]);
    }
  };

  const { publisher } = usePublisherProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!publisher) {
      toast.error("Publisher profile not found. Please reload.");
      return;
    }

    setIsSubmitting(true);

    try {
      const magazineData = {
        publisher_id: publisher.id,
        title: formData.title,
        issue_number: formData.issueNumber,
        issue_frequency: formData.frequency,
        category: formData.category,
        subcategory: formData.subcategory || null,
        width_mm: parseFloat(formData.widthMm) || null,
        height_mm: parseFloat(formData.heightMm) || null,
        weight_grams: parseFloat(formData.weightGrams) || null,
        page_count: parseInt(formData.pageCount) || null,
        print_run: formData.printRun,
        warehouse_location: formData.warehouseLocation,
        restock_timeline: formData.restockTimeline,
        inventory_count: formData.fulfillmentMethod === 'publisher_handled'
          ? (parseInt(formData.availableQuantities.replace(/,/g, '')) || 0)
          : 0, // Neesh-handled magazines don't track publisher inventory
        description: formData.descriptiveText,
        isbn: formData.isbn || null,
        metadata: formData.metadata,
        discount_structure: formData.discountStructure,
        payment_terms: formData.paymentTerms,
        wholesale_price: parseFloat(formData.wholesalePrice) || 0,
        // LEGACY: The 'price' column is required by the database but deprecated in favor of 'wholesale_price'.
        // We mirror 'wholesale_price' to satisfy the constraint until a migration can make it nullable.
        price: parseFloat(formData.wholesalePrice) || 0,
        suggested_retail_price: parseFloat(formData.retailPrice) || 0,
        cover_image_url: coverImageUrl,
        sample_spread_url: sampleSpreadUrl,
        logo_url: logoUrl,
        origin_country_code: formData.originCountryCode,
        publication_date: formData.publicationDate,
        // Using existing columns based on schema inference
        publication_type: formData.isSingleIssue ? 'Issue' : 'Journal',
        is_active: true,
        fulfillment_method: formData.fulfillmentMethod,
        minimum_order_quantity: parseInt(formData.minimumOrderQuantity) || 1,
      };

      if (isNew) {
        const { error } = await supabase
          .from('magazines')
          .insert(magazineData);
        
        if (error) throw error;
        toast.success("Magazine created successfully");
      } else {
        const { error } = await supabase
          .from('magazines')
          .update(magazineData)
          .eq('id', id);

        if (error) throw error;
        toast.success("Magazine updated successfully");
      }

      // Clear saved form data after successful save
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}-images`);

      navigate("/publisher/titles");
    } catch (error) {
      // Error is already logged by Supabase client or handled by toast
      toast.error("Failed to save magazine. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title={isNew ? "Add New Title" : "Edit Title"}
        onBack={() => navigate("/publisher/titles")}
      />

      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Magazine Details */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Magazine Details</h3>
              <div className="space-y-4">
                <FormInput
                  label="Full Magazine Title"
                  value={formData.title}
                  onChange={handleInputChange("title")}
                  placeholder="Enter magazine title"
                />
                <FormInput
                  label="Issue Number or Seasonal ID"
                  value={formData.issueNumber}
                  onChange={handleInputChange("issueNumber")}
                  placeholder="e.g., Issue 45, Spring 2024"
                />
                <FormInput
                  label="Publication Frequency"
                  value={formData.frequency}
                  onChange={handleInputChange("frequency")}
                  placeholder="e.g., Quarterly, Monthly"
                />
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isSingleIssue}
                      onChange={handleCheckboxChange("isSingleIssue")}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-body text-foreground">Single issue</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isSeries}
                      onChange={handleCheckboxChange("isSeries")}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-body text-foreground">Series</span>
                  </label>
                </div>
                <FormSelect
                  label="Category"
                  value={formData.category}
                  onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  options={getCategoryOptions()}
                  placeholder="Select a category"
                />
                <FormSelect
                  label="Subcategory (Optional)"
                  value={formData.subcategory}
                  onChange={(value) => setFormData(prev => ({ ...prev, subcategory: value }))}
                  options={getCategoryOptions()}
                  placeholder="Select a secondary category"
                />
                <div className="grid grid-cols-3 gap-3">
                  <FormInput
                    label="Width (mm)"
                    value={formData.widthMm}
                    onChange={handleInputChange("widthMm")}
                    placeholder="e.g., 210"
                    type="number"
                  />
                  <FormInput
                    label="Height (mm)"
                    value={formData.heightMm}
                    onChange={handleInputChange("heightMm")}
                    placeholder="e.g., 297"
                    type="number"
                  />
                  <FormInput
                    label="Weight (g)"
                    value={formData.weightGrams}
                    onChange={handleInputChange("weightGrams")}
                    placeholder="e.g., 350"
                    type="number"
                  />
                </div>
                <FormInput
                  label="Page Count"
                  value={formData.pageCount}
                  onChange={handleInputChange("pageCount")}
                  placeholder="e.g., 160"
                />
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Origin Country</Label>
                  <CountrySelect
                    value={formData.originCountryCode}
                    onChange={(value) => setFormData(prev => ({ ...prev, originCountryCode: value }))}
                    allowClear={true}
                    placeholder="Select country"
                  />
                  <p className="text-xs text-muted-foreground">
                    Where is this publication based? This helps retailers answer customer questions.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Publication Date</Label>
                  <MonthYearPicker
                    value={formData.publicationDate}
                    onChange={(value) => setFormData(prev => ({ ...prev, publicationDate: value }))}
                    allowClear={true}
                    allowFuture={true}
                  />
                  <p className="text-xs text-muted-foreground">
                    When was this issue released? This helps retailers find the newest titles.
                  </p>
                </div>
              </div>
            </div>

            {/* Inventory & Logistics */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Inventory & Logistics</h3>
              <div className="space-y-4">
                {/* Fulfillment Method */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Fulfillment Method</Label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary transition-colors">
                      <input
                        type="radio"
                        name="fulfillmentMethod"
                        value="publisher_handled"
                        checked={formData.fulfillmentMethod === 'publisher_handled'}
                        onChange={(e) => setFormData(prev => ({ ...prev, fulfillmentMethod: e.target.value }))}
                        className="mt-0.5 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-foreground">I handle shipping & storage</div>
                        <p className="text-sm text-muted-foreground">You manage your own inventory and ship orders directly to retailers</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/50 opacity-60 cursor-not-allowed">
                      <input
                        type="radio"
                        name="fulfillmentMethod"
                        value="neesh_handled"
                        disabled
                        className="mt-0.5 w-4 h-4 cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-muted-foreground">Neesh handles shipping & storage</span>
                          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
                            Coming Soon
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">Send stock to our warehouse and we'll handle fulfillment</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Conditional Fields for Publisher-Handled */}
                {formData.fulfillmentMethod === 'publisher_handled' && (
                  <>
                    <FormInput
                      label="Current Inventory"
                      value={formData.availableQuantities}
                      onChange={handleInputChange("availableQuantities")}
                      placeholder="How many copies do you have in stock?"
                      type="number"
                      helperText="This will be deducted automatically when orders are placed"
                    />
                    <FormInput
                      label="Warehouse Location"
                      value={formData.warehouseLocation}
                      onChange={handleInputChange("warehouseLocation")}
                      placeholder="e.g., Portland, OR"
                      helperText="Where are you shipping from?"
                    />
                    <FormInput
                      label="Restock Timeline"
                      value={formData.restockTimeline}
                      onChange={handleInputChange("restockTimeline")}
                      placeholder="e.g., 8 weeks"
                      helperText="How long until you can restock?"
                    />
                  </>
                )}

                {/* Neesh-Handled Info */}
                {formData.fulfillmentMethod === 'neesh_handled' && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-foreground">
                      <strong>Neesh Fulfillment:</strong> Once you send inventory to our warehouse, 
                      we'll update your stock levels and handle all shipping to retailers.
                    </p>
                  </div>
                )}

                {/* Common Fields */}
                <FormInput
                  label="Print Run"
                  value={formData.printRun}
                  onChange={handleInputChange("printRun")}
                  placeholder="Total copies printed"
                  helperText="Total number of copies produced"
                />
                <FormInput
                  label="Minimum Order Quantity"
                  value={formData.minimumOrderQuantity}
                  onChange={handleInputChange("minimumOrderQuantity")}
                  placeholder="e.g., 1"
                  type="number"
                  helperText="Minimum copies retailers must purchase in a single order"
                />
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Assets */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Assets</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Accepted formats: JPG, PNG, or WebP. For best results, use high-resolution images (300 DPI).
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Cover Image</label>
                  <FileUploadZone
                    title="Upload Cover Image"
                    subtitle="High-resolution cover image (max 10MB)"
                    accept="image/*"
                    onFilesSelected={handleCoverUpload}
                    isUploading={coverUpload.isUploading}
                    uploadProgress={coverUpload.progress}
                    uploadedUrl={coverImageUrl || undefined}
                    error={coverUpload.error || undefined}
                    onRemove={() => {
                      setCoverImageUrl(null);
                      coverUpload.reset();
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Sample Spread</label>
                  <FileUploadZone
                    title="Upload Sample Spread"
                    subtitle="Representative 2-page spread (max 10MB)"
                    accept="image/*"
                    onFilesSelected={handleSpreadUpload}
                    isUploading={spreadUpload.isUploading}
                    uploadProgress={spreadUpload.progress}
                    uploadedUrl={sampleSpreadUrl || undefined}
                    error={spreadUpload.error || undefined}
                    onRemove={() => {
                      setSampleSpreadUrl(null);
                      spreadUpload.reset();
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Logo</label>
                  <FileUploadZone
                    title="Upload Logo"
                    subtitle="Vector format preferred (max 2MB)"
                    accept="image/*,.svg"
                    onFilesSelected={handleLogoUpload}
                    isUploading={logoUpload.isUploading}
                    uploadProgress={logoUpload.progress}
                    uploadedUrl={logoUrl || undefined}
                    error={logoUpload.error || undefined}
                    onRemove={() => {
                      setLogoUrl(null);
                      logoUpload.reset();
                    }}
                  />
                </div>

                <FormTextarea
                  label="Descriptive Text"
                  value={formData.descriptiveText}
                  onChange={handleInputChange("descriptiveText")}
                  placeholder="Short description for marketing and catalog listings"
                  rows={3}
                />
                <FormInput
                  label="ISBN"
                  value={formData.isbn}
                  onChange={handleInputChange("isbn")}
                  placeholder="e.g., 978-3-16-148410-0"
                  helperText="International Standard Book Number (if applicable)"
                />
                <FormInput
                  label="Additional Metadata"
                  value={formData.metadata}
                  onChange={handleInputChange("metadata")}
                  placeholder="ISSN, keywords, tags"
                  helperText="ISSN, keywords, or other searchable tags"
                />
              </div>
            </div>

            {/* Commercial Terms */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Commercial Terms</h3>
              <div className="space-y-4">
                <FormInput
                  label="Wholesale Price (WSP)"
                  value={formData.wholesalePrice}
                  onChange={handleInputChange("wholesalePrice")}
                  placeholder="e.g., 28.00"
                  type="number"
                />
                <FormInput
                  label="Retail Price (SRP)"
                  value={formData.retailPrice}
                  onChange={handleInputChange("retailPrice")}
                  placeholder="e.g., 45.00"
                  type="number"
                />
                <FormInput
                  label="Discount Structure"
                  value={formData.discountStructure}
                  onChange={handleInputChange("discountStructure")}
                  placeholder="e.g., 10% for 50+, 15% for 100+"
                  helperText="Available discounts for bulk orders"
                />
                <FormInput
                  label="Payment Terms & Schedule"
                  value={formData.paymentTerms}
                  onChange={handleInputChange("paymentTerms")}
                  placeholder="e.g., Net 30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-8">
          <ButtonPrimary
            fullWidth
            variant="purple"
            icon={<Check className="w-4 h-4" />}
            onClick={handleSubmit}
            disabled={coverUpload.isUploading || spreadUpload.isUploading || logoUpload.isUploading || isSubmitting}
          >
            {isSubmitting ? "Saving..." : (isNew ? "Create Magazine" : "Confirm Edits")}
          </ButtonPrimary>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherEditTitle;
