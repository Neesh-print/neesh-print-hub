import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/neesh/HeaderBar";
import { NavigationMenu } from "@/components/shared";

export interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuClick = () => {
    setIsMenuOpen(true);
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

      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userRole="admin"
      />
    </div>
  );
};
