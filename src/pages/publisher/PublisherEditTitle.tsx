import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, FormInput, FormTextarea, FileUploadZone, ButtonPrimary } from "@/components/neesh";
import { useFileUpload } from "@/hooks/useFileUpload";
import { CountrySelect } from "@/components/ui/country-select";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const PublisherEditTitle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  // Form state
  const [formData, setFormData] = useState({
    title: isNew ? "" : "Kinfolk Magazine",
    issueNumber: isNew ? "" : "Issue 45",
    frequency: isNew ? "" : "Quarterly",
    isSingleIssue: true,
    isSeries: false,
    genres: isNew ? "" : "Lifestyle, Design, Culture",
    dimensions: isNew ? "" : "210 x 280mm, 350g",
    pageCount: isNew ? "" : "160",
    printRun: isNew ? "" : "25,000",
    warehouseLocation: isNew ? "" : "Portland, OR",
    availableQuantities: isNew ? "" : "2,500",
    restockTimeline: isNew ? "" : "8 weeks",
    promotionalText: isNew ? "" : "A slow lifestyle magazine celebrating the simple things.",
    metadata: isNew ? "" : "ISSN 2325-1654, kinfolk, lifestyle, design",
    wholesalePrice: isNew ? "" : "28.00",
    retailPrice: isNew ? "" : "45.00",
    discountStructure: isNew ? "" : "10% for 50+, 15% for 100+",
    paymentTerms: isNew ? "" : "Net 30",
    originCountryCode: isNew ? null as string | null : "US",
    publicationDate: isNew ? null as string | null : "2025-01-01",
  });

  // Uploaded image URLs
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [sampleSpreadUrl, setSampleSpreadUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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

  const handleSubmit = () => {
    const magazineData = {
      ...formData,
      cover_image_url: coverImageUrl,
      sample_spread_url: sampleSpreadUrl,
      logo_url: logoUrl,
      origin_country_code: formData.originCountryCode,
      publication_date: formData.publicationDate,
    };
    
    console.log("Submitting:", magazineData);
    toast.success(isNew ? "Magazine created successfully" : "Magazine updated successfully");
    navigate("/publisher/titles");
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
                <FormInput
                  label="Genre(s)"
                  value={formData.genres}
                  onChange={handleInputChange("genres")}
                  placeholder="e.g., Lifestyle, Design, Culture"
                />
                <FormInput
                  label="Dimensions"
                  value={formData.dimensions}
                  onChange={handleInputChange("dimensions")}
                  placeholder="width x height in mm or inches & weight"
                  helperText="width x height in mm or inches & weight"
                />
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
                    allowFuture={false}
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
                <FormInput
                  label="Print Run"
                  value={formData.printRun}
                  onChange={handleInputChange("printRun")}
                  placeholder="Total copies printed"
                  helperText="Total copies printed"
                />
                <FormInput
                  label="Warehouse Location"
                  value={formData.warehouseLocation}
                  onChange={handleInputChange("warehouseLocation")}
                  placeholder="e.g., Portland, OR"
                />
                <FormInput
                  label="Available Quantities"
                  value={formData.availableQuantities}
                  onChange={handleInputChange("availableQuantities")}
                  placeholder="Current stock available"
                />
                <FormInput
                  label="Restock Timeline"
                  value={formData.restockTimeline}
                  onChange={handleInputChange("restockTimeline")}
                  placeholder="e.g., 8 weeks"
                />
              </div>
            </div>

            {/* File Format */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">File Format</h3>
              <p className="text-body text-muted-foreground">
                Upload high-resolution images (JPG, PNG, or WebP). For best results, use 300 DPI images.
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Assets */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Assets</h3>
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
                  label="Promotional Text"
                  value={formData.promotionalText}
                  onChange={handleInputChange("promotionalText")}
                  placeholder="Short description for marketing"
                  rows={3}
                />
                <FormInput
                  label="Metadata"
                  value={formData.metadata}
                  onChange={handleInputChange("metadata")}
                  placeholder="ISBN, ISSN, keywords"
                  helperText="ISBN, ISSN, keywords"
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
            disabled={coverUpload.isUploading || spreadUpload.isUploading || logoUpload.isUploading}
          >
            {isNew ? "Create Magazine" : "Confirm Edits"}
          </ButtonPrimary>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherEditTitle;
