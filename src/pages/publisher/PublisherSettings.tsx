import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, FormInput, ButtonSecondary, ButtonPrimary, FormTextarea } from "@/components/neesh";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SocialLinkInput } from "@/components/ui/social-link-input";
import { useAuth } from "@/hooks/useAuth";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const PublisherSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { publisher, isLoading, updateProfile } = usePublisherProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    company_name: "",
    description: "",
  });

  // Social links state
  const [instagramHandle, setInstagramHandle] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // Sync with publisher data
  useEffect(() => {
    if (publisher) {
      setFormData({
        company_name: publisher.company_name || "",
        description: publisher.description || "",
      });
      setInstagramHandle(publisher.instagram_handle);
      setWebsiteUrl(publisher.website_url);
    }
  }, [publisher]);

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    newOrderAlerts: true,
    lowInventoryWarnings: true,
    weeklySalesDigest: false,
    messagesFromNeesh: true,
  });

  const handleBack = () => {
    navigate("/publisher");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateProfile(formData);
      if (success) {
        toast.success("Profile saved successfully");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (isLoading) {
    return (
      <PublisherLayout>
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      </PublisherLayout>
    );
  }

  return (
    <PublisherLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <BackNavigation
          title="Settings"
          onBack={handleBack}
        />

        <div className="space-y-6">
          {/* Publisher Profile */}
          <div className="card-neesh">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-lg text-foreground">
                Publisher Profile
                </h3>
                <ButtonPrimary onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </ButtonPrimary>
            </div>
            
            <div className="space-y-4">
              <FormInput
                label="Company / Publication Name"
                placeholder="e.g. Kinfolk"
                value={formData.company_name}
                onChange={(value) => handleChange('company_name', value)}
              />

              <FormTextarea
                label="Description / Bio"
                placeholder="Tell retailers about your publications..."
                value={formData.description}
                onChange={(value) => handleChange('description', value)}
              />
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Notification Preferences
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="newOrderAlerts" className="cursor-pointer">
                  New order alerts
                </Label>
                <Switch
                  id="newOrderAlerts"
                  checked={notifications.newOrderAlerts}
                  onCheckedChange={() => handleNotificationChange('newOrderAlerts')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="lowInventoryWarnings" className="cursor-pointer">
                  Low inventory warnings
                </Label>
                <Switch
                  id="lowInventoryWarnings"
                  checked={notifications.lowInventoryWarnings}
                  onCheckedChange={() => handleNotificationChange('lowInventoryWarnings')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="weeklySalesDigest" className="cursor-pointer">
                  Weekly sales digest
                </Label>
                <Switch
                  id="weeklySalesDigest"
                  checked={notifications.weeklySalesDigest}
                  onCheckedChange={() => handleNotificationChange('weeklySalesDigest')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="messagesFromNeesh" className="cursor-pointer">
                  Messages from Neesh
                </Label>
                <Switch
                  id="messagesFromNeesh"
                  checked={notifications.messagesFromNeesh}
                  onCheckedChange={() => handleNotificationChange('messagesFromNeesh')}
                />
            </div>
          </div>

          {/* Social & Web */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Social & Web
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Instagram</Label>
                <SocialLinkInput
                  type="instagram"
                  value={instagramHandle}
                  onChange={setInstagramHandle}
                />
                <p className="mt-1.5 text-caption text-muted-foreground">
                  Your Instagram handle helps retailers gauge your audience reach
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Website</Label>
                <SocialLinkInput
                  type="website"
                  value={websiteUrl}
                  onChange={setWebsiteUrl}
                />
                <p className="mt-1.5 text-caption text-muted-foreground">
                  Link to your publication's website or online store
                </p>
              </div>

              <ButtonPrimary
                onClick={async () => {
                  setIsSavingSocial(true);
                  const success = await updateProfile({
                    instagram_handle: instagramHandle,
                    website_url: websiteUrl,
                  });
                  setIsSavingSocial(false);
                  if (success) {
                    toast.success("Social links updated");
                  } else {
                    toast.error("Failed to update social links");
                  }
                }}
                disabled={isSavingSocial}
              >
                {isSavingSocial ? "Saving..." : "Save Social Links"}
              </ButtonPrimary>
            </div>
          </div>
          </div>

          {/* Payout Settings */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Payout Settings
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                Update your bank account details for receiving periodic payouts.
              </p>
              
              <FormInput
                label="Bank Name"
                value="Stripe Connected Account"
                onChange={() => {}}
                disabled
                helperText="Managed via Stripe Connect"
              />

              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Stripe Connect Status</p>
                    <p className="text-sm text-muted-foreground">Account active and ready for payouts</p>
                  </div>
                  <ButtonSecondary 
                    onClick={async () => {
                      try {
                        setIsOpeningDashboard(true);
                        const { data, error } = await supabase.functions.invoke('create-connect-login-link');
                        
                        if (error) {
                          // Check if it's a 404 (no Stripe account)
                          if (error.message?.includes('404') || error.message?.includes('not found')) {
                            toast.error("No Stripe account connected. Please contact support to set up payouts.");
                            return;
                          }
                          throw error;
                        }
                        
                        if (data?.url) {
                          window.open(data.url, '_blank');
                        } else {
                          toast.error("Could not generate dashboard link");
                        }
                      } catch (error) {
                        console.error('Error opening dashboard:', error);
                        toast.error("Failed to open Stripe Dashboard");
                      } finally {
                        setIsOpeningDashboard(false);
                      }
                    }}
                    disabled={isOpeningDashboard}
                  >
                    {isOpeningDashboard ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      "View Dashboard"
                    )}
                  </ButtonSecondary>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Payout schedule</p>
                <p className="text-foreground">Monthly, on the 15th</p>
              </div>

              <ButtonSecondary onClick={() => navigate("/publisher/settings/payout")}>
                Update Payout Method
              </ButtonSecondary>

              <p className="text-sm text-muted-foreground">
                To update your bank account details, please visit your Stripe Express dashboard.
              </p>
            </div>
          </div>

          {/* Account */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Account
            </h3>
            <div className="space-y-4">
              <FormInput
                label="Email"
                value={user?.email || "publisher@example.com"}
                onChange={() => {}}
                disabled
              />

              <ButtonSecondary>
                Change Password
              </ButtonSecondary>

              <Separator className="my-4" />

              {/* Danger Zone */}
              <div>
                <h4 className="font-medium text-destructive mb-1">Deactivate Account</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  This will deactivate your account. Your titles and order history will be preserved.
                </p>
                <ButtonSecondary destructive>
                  Deactivate Account
                </ButtonSecondary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherSettings;