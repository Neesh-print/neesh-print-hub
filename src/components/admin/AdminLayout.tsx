import { ReactNode } from "react";
import { AdminV2Layout } from "@/components/admin/v2/AdminV2Layout";

export interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Layout for admin pages built before the v2 redesign. They now sit in the
 * same menu as Today and Orders, keeping the spacing they were built for.
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => (
  <AdminV2Layout variant="classic">{children}</AdminV2Layout>
);
