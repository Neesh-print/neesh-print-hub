import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/neesh/HeaderBar";

export interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();

  const handleMenuClick = () => {
    // TODO: Open admin menu/sidebar
    console.log("Menu clicked");
  };

  const handleLogoClick = () => {
    navigate("/admin");
  };

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        userRole="admin"
        onMenuClick={handleMenuClick}
        onLogoClick={handleLogoClick}
      />
      
      <main className="pt-16 pb-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
};
