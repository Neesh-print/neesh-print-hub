import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, FormInput, ButtonSecondary, ButtonPrimary } from "@/components/neesh";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SocialLinkInput } from "@/components/ui/social-link-input";
import { useAuth } from "@/hooks/useAuth";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { toast } from "sonner";

export const PublisherSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { publisher, updateProfile } = usePublisherProfile();

  // Social links state
  const [instagramHandle, setInstagramHandle] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // Sync with publisher data
  useEffect(() => {
    if (publisher) {
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

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <PublisherLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <BackNavigation
          title="Settings"
          onBack={handleBack}
        />

        <div className="space-y-6">
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
              <div>
                <p className="text-sm text-muted-foreground">Current payout method</p>
                <p className="text-foreground">Bank account ending in ****1234</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Payout schedule</p>
                <p className="text-foreground">Monthly, on the 15th</p>
              </div>

              <ButtonSecondary onClick={() => navigate("/publisher/settings/payout")}>
                Update Payout Method
              </ButtonSecondary>

              <p className="text-sm text-muted-foreground">
                Contact support@neesh.art to change your payout details
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
                <h4 className="font-medium text-destructive mb-1">Delete Account</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  This will permanently delete your account, titles, and order history
                </p>
                <ButtonSecondary destructive>
                  Delete Account
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