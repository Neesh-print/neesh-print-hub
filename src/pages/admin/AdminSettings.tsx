import { AdminLayout } from "@/components/admin/AdminLayout";
import { CustomsHandlingCard } from "@/components/admin/CustomsHandlingCard";
import { SettingsPage } from "@/pages/shared/SettingsPage";

export const AdminSettings = () => {
  return (
    <AdminLayout>
      <SettingsPage userRole="admin" />
      <div className="px-4 md:px-6 pb-8 max-w-3xl">
        <CustomsHandlingCard />
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
