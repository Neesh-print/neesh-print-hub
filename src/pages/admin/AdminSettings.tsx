import { AdminLayout } from "@/components/admin/AdminLayout";
import { SettingsPage } from "@/pages/shared/SettingsPage";

export const AdminSettings = () => {
  return (
    <AdminLayout>
      <SettingsPage userRole="admin" />
    </AdminLayout>
  );
};

export default AdminSettings;
