import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/neesh";
import { NavigationMenu } from "@/components/shared";

interface PublisherLayoutProps {
  children: ReactNode;
}

export const PublisherLayout = ({ children }: PublisherLayoutProps) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuClick = () => {
    setIsMenuOpen(true);
  };

  const handleLogoClick = () => {
    navigate("/publisher");
  };

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        userRole="publisher"
        onMenuClick={handleMenuClick}
        onLogoClick={handleLogoClick}
      />
      <main className="pt-16">
        {children}
      </main>
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userRole="publisher"
      />
    </div>
  );
};
