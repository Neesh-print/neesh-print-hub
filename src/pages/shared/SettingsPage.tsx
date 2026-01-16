import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BackNavigation, InfoCard, FormInput } from "@/components/neesh";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Bell, Shield, Download, Trash2, Lock } from "lucide-react";

interface SettingsPageProps {
  userRole: 'publisher' | 'retailer' | 'admin';
}

export const SettingsPage = ({ userRole }: SettingsPageProps) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  // Notification preferences state
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    newMessages: true,
    newsletters: false,
    productUpdates: true,
  });

  const basePath = `/${userRole}`;

  const handleBack = () => {
    navigate(basePath);
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    toast({
      title: "Settings updated",
      description: "Your notification preferences have been saved.",
    });
  };

  const handleChangePassword = () => {
    navigate('/forgot-password');
  };

  const handleExportData = () => {
    toast({
      title: "Export requested",
      description: "Your data export will be emailed to you within 24 hours.",
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: "Request submitted",
      description: "Account deletion requests are reviewed within 7 business days.",
      variant: "destructive",
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <BackNavigation
        title="Settings"
        onBack={handleBack}
      />

      <div className="space-y-6">
        {/* Account Section */}
        <InfoCard title="Account">
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Email Address</Label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{user?.email || 'Not set'}</span>
              </div>
            </div>
            
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={handleChangePassword}
                className="w-full sm:w-auto"
              >
                <Lock className="w-4 h-4 mr-2" />
                Change Password
              </Button>
            </div>
          </div>
        </InfoCard>

        {/* Notifications Section */}
        <InfoCard title="Notifications">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Order Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about order status changes
                </p>
              </div>
              <Switch
                checked={notifications.orderUpdates}
                onCheckedChange={() => handleNotificationChange('orderUpdates')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Messages</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email notifications for new messages
                </p>
              </div>
              <Switch
                checked={notifications.newMessages}
                onCheckedChange={() => handleNotificationChange('newMessages')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Product Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get updates about new products and features
                </p>
              </div>
              <Switch
                checked={notifications.productUpdates}
                onCheckedChange={() => handleNotificationChange('productUpdates')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Newsletters</Label>
                <p className="text-sm text-muted-foreground">
                  Receive our monthly newsletter
                </p>
              </div>
              <Switch
                checked={notifications.newsletters}
                onCheckedChange={() => handleNotificationChange('newsletters')}
              />
            </div>
          </div>
        </InfoCard>

        {/* Privacy Section */}
        <InfoCard title="Privacy">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">Export Your Data</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Download a copy of all your data including orders, profile information, and activity history.
              </p>
              <Button
                variant="outline"
                onClick={handleExportData}
              >
                <Download className="w-4 h-4 mr-2" />
                Request Data Export
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-destructive mb-1">Delete Account</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Request Account Deletion
              </Button>
            </div>
          </div>
        </InfoCard>
      </div>
    </div>
  );
};

export default SettingsPage;
