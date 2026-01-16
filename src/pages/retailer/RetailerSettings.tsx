import { RetailerLayout } from "@/components/retailer/RetailerLayout";
import { SettingsPage } from "@/pages/shared/SettingsPage";

export const RetailerSettings = () => {
  return (
    <RetailerLayout>
      <SettingsPage userRole="retailer" />
    </RetailerLayout>
  );
};

export default RetailerSettings;
