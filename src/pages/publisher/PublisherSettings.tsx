import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { SettingsPage } from "@/pages/shared/SettingsPage";

export const PublisherSettings = () => {
  return (
    <PublisherLayout>
      <SettingsPage userRole="publisher" />
    </PublisherLayout>
  );
};

export default PublisherSettings;
