import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, FormInput, FormTextarea, ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { SocialLinkInput } from "@/components/ui/social-link-input";
import { Label } from "@/components/ui/label";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { toast } from "sonner";

export const PublisherEditProfile = () => {
  const navigate = useNavigate();
  const { publisher, updateProfile, isLoading } = usePublisherProfile();

  const [formData, setFormData] = useState({
    company_name: "",
    description: "",
    instagram_handle: "",
    website_url: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Sync form with publisher data
  useEffect(() => {
    if (publisher) {
      setFormData({
        company_name: publisher.company_name || "",
        description: publisher.description || "",
        instagram_handle: publisher.instagram_handle || "",
        website_url: publisher.website_url || "",
      });
    }
  }, [publisher]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const success = await updateProfile({
      company_name: formData.company_name || null,
      description: formData.description || null,
      instagram_handle: formData.instagram_handle || null,
      website_url: formData.website_url || null,
    });

    setIsSaving(false);

    if (success) {
      toast.success("Profile updated successfully");
      navigate("/publisher/profile");
    } else {
      toast.error("Failed to update profile");
    }
  };

  if (isLoading) {
    return (
      <PublisherLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-secondary rounded w-1/3" />
            <div className="h-32 bg-secondary rounded" />
          </div>
        </div>
      </PublisherLayout>
    );
  }

  return (
    <PublisherLayout>
      <BackNavigation
        title="Edit Profile"
        onBack={() => navigate("/publisher/profile")}
      />

      <div className="px-4 md:px-6 pb-12 max-w-2xl mx-auto">
        <p className="text-muted-foreground mb-6">
          Update your publication details to help retailers discover your titles.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="card-neesh space-y-4">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Publication Info
            </h3>

            <FormInput
              label="Publication Name"
              value={formData.company_name}
              onChange={(value) => handleChange("company_name", value)}
              placeholder="Enter your publication or company name"
              required
            />

            <FormTextarea
              label="Description"
              value={formData.description}
              onChange={(value) => handleChange("description", value)}
              placeholder="Tell retailers about your publication, your focus, and what makes you unique..."
              rows={4}
            />
          </div>

          {/* Social & Web */}
          <div className="card-neesh space-y-4">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Social & Web
            </h3>

            <div>
              <Label className="mb-2 block">Instagram</Label>
              <SocialLinkInput
                type="instagram"
                value={formData.instagram_handle}
                onChange={(value) => handleChange("instagram_handle", value || "")}
              />
              <p className="mt-1.5 text-caption text-muted-foreground">
                Your Instagram handle helps retailers gauge your audience reach
              </p>
            </div>

            <div>
              <Label className="mb-2 block">Website</Label>
              <SocialLinkInput
                type="website"
                value={formData.website_url}
                onChange={(value) => handleChange("website_url", value || "")}
              />
              <p className="mt-1.5 text-caption text-muted-foreground">
                Link to your publication's website or online store
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <ButtonSecondary
              type="button"
              onClick={() => navigate("/publisher/profile")}
            >
              Cancel
            </ButtonSecondary>
            <ButtonPrimary type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </ButtonPrimary>
          </div>
        </form>
      </div>
    </PublisherLayout>
  );
};

export default PublisherEditProfile;
