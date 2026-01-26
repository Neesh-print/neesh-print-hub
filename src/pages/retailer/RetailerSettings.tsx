import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RetailerLayout } from "@/components/retailer/RetailerLayout";
import { BackNavigation, FormInput, ButtonSecondary, ButtonPrimary, FormTextarea } from "@/components/neesh";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRetailerProfile } from "@/hooks/useRetailerProfile";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const RetailerSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { retailer, isLoading, updateProfile } = useRetailerProfile();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    shop_name: "",
    shop_description: "",
    shop_url: "",
    instagram_handle: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });

  // Sync form data when retailer data loads
  useEffect(() => {
    if (retailer) {
      setFormData({
        shop_name: retailer.shop_name || "",
        shop_description: retailer.shop_description || "",
        shop_url: retailer.shop_url || "",
        instagram_handle: retailer.instagram_handle || "",
        address: retailer.address || "",
        city: retailer.city || "",
        state: retailer.state || "",
        postal_code: retailer.postal_code || "",
        country: retailer.country || "",
      });
    }
  }, [retailer]);

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    orderStatusUpdates: true,
    newTitlesFromPublishers: true,
    weeklyNewArrivalsDigest: false,
    messagesFromNeesh: true,
  });

  const handleBack = () => {
    navigate("/retailer");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateProfile(formData);
      if (success) {
        toast({
          title: "Settings saved",
          description: "Your profile has been updated successfully.",
        });
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
      <RetailerLayout>
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      </RetailerLayout>
    );
  }

  return (
    <RetailerLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <BackNavigation
          title="Settings"
          onBack={handleBack}
        />

        <div className="space-y-6">
            
          {/* Store Profile */}
          <div className="card-neesh">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-lg text-foreground">
                Store Profile
                </h3>
                <ButtonPrimary onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </ButtonPrimary>
            </div>
            
            <div className="space-y-4">
              <FormInput
                label="Shop Name"
                placeholder="e.g. Powell's City of Books"
                value={formData.shop_name}
                onChange={(value) => handleChange('shop_name', value)}
              />

              <FormTextarea
                label="Description"
                placeholder="Tell us about your store..."
                value={formData.shop_description}
                onChange={(value) => handleChange('shop_description', value)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormInput
                    label="Website"
                    placeholder="https://..."
                    value={formData.shop_url}
                    onChange={(value) => handleChange('shop_url', value)}
                  />
                  <FormInput
                    label="Instagram"
                    placeholder="@..."
                    value={formData.instagram_handle}
                    onChange={(value) => handleChange('instagram_handle', value)}
                  />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Shipping Address
            </h3>
            <div className="space-y-4">
              <FormInput
                label="Street Address"
                value={formData.address}
                onChange={(value) => handleChange('address', value)}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                    label="City"
                    value={formData.city}
                    onChange={(value) => handleChange('city', value)}
                />
                <FormInput
                    label="State / Province"
                    value={formData.state}
                    onChange={(value) => handleChange('state', value)}
                />
              </div>

               <div className="grid grid-cols-2 gap-4">
                <FormInput
                    label="Postal Code"
                    value={formData.postal_code}
                    onChange={(value) => handleChange('postal_code', value)}
                />
                <FormInput
                    label="Country"
                    value={formData.country}
                    onChange={(value) => handleChange('country', value)}
                />
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Notification Preferences
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="orderStatusUpdates" className="cursor-pointer">
                  Order status updates
                </Label>
                <Switch
                  id="orderStatusUpdates"
                  checked={notifications.orderStatusUpdates}
                  onCheckedChange={() => handleNotificationChange('orderStatusUpdates')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="newTitlesFromPublishers" className="cursor-pointer">
                  New titles from publishers I've ordered from
                </Label>
                <Switch
                  id="newTitlesFromPublishers"
                  checked={notifications.newTitlesFromPublishers}
                  onCheckedChange={() => handleNotificationChange('newTitlesFromPublishers')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="weeklyNewArrivalsDigest" className="cursor-pointer">
                  Weekly new arrivals digest
                </Label>
                <Switch
                  id="weeklyNewArrivalsDigest"
                  checked={notifications.weeklyNewArrivalsDigest}
                  onCheckedChange={() => handleNotificationChange('weeklyNewArrivalsDigest')}
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
          </div>


          {/* Account */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Account
            </h3>
            <div className="space-y-4">
              <FormInput
                label="Email"
                value={user?.email || ""}
                onChange={() => {}}
                disabled
              />

              <Button variant="outline">
                Change Password
              </Button>

              <Separator className="my-4" />

              {/* Danger Zone */}
              <div>
                <h4 className="font-medium text-destructive mb-1">Delete Account</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  This will permanently delete your account and order history
                </p>
                <Button variant="destructive">
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RetailerLayout>
  );
};

export default RetailerSettings;
