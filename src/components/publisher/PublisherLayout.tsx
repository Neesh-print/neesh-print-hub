import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/neesh";
import { NavigationMenu } from "@/components/shared";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";

interface PublisherLayoutProps {
  children: ReactNode;
}

export const PublisherLayout = ({ children }: PublisherLayoutProps) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useOrderNotifications();

  const handleMenuClick = () => {
    setIsMenuOpen(true);
  };

  const handleLogoClick = () => {
    navigate("/publisher");
  };

  const handleNotificationClick = (orderId: string) => {
    navigate(`/publisher/orders/${orderId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        userRole="publisher"
        onMenuClick={handleMenuClick}
        onLogoClick={handleLogoClick}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onNotificationClick={handleNotificationClick}
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
