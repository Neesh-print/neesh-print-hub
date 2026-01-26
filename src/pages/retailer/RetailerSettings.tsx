import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RetailerLayout } from "@/components/retailer/RetailerLayout";
import { BackNavigation, FormInput } from "@/components/neesh";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRetailerProfile } from "@/hooks/useRetailerProfile";
import { getStateLabel } from "@/lib/geography";

export const RetailerSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { retailer } = useRetailerProfile();

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

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleUpdateAddress = () => {
    navigate("/retailer/profile/edit");
  };

  return (
    <RetailerLayout>
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

          {/* Store Address (from profile) */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg text-foreground mb-4">
              Store Address
            </h3>
            <div className="space-y-4">
              {retailer?.city && retailer?.state ? (
                <div className="text-foreground">
                  <p className="font-medium">{retailer.shop_name || 'Your Store'}</p>
                  {retailer.address && <p>{retailer.address}</p>}
                  <p>{retailer.city}, {getStateLabel(retailer.state) || retailer.state} {retailer.postal_code || ''}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No store address on file</p>
              )}

              <Button variant="outline" onClick={handleUpdateAddress}>
                Update Store Address
              </Button>

              <p className="text-sm text-muted-foreground">
                Your store address is managed in your profile
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
                value={user?.email || "retailer@example.com"}
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
