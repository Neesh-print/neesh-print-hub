import { ReactNode } from "react";
import { HeaderBar } from "@/components/neesh";

interface PublisherLayoutProps {
  children: ReactNode;
}

export const PublisherLayout = ({ children }: PublisherLayoutProps) => {
  const handleMenuClick = () => {
    // TODO: Open menu drawer
    console.log("Menu clicked");
  };

  const handleLogoClick = () => {
    window.location.href = "/publisher";
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
    </div>
  );
};
