import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { NavigationMenu, MobileBottomNav, SidebarNav } from "@/components/shared";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { NotificationBell } from "@/components/neesh/NotificationBell";
import { Logo } from "@/components/neesh/Logo";

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

  const handleNotificationClick = (orderId: string) => {
    navigate(`/publisher/orders/${orderId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <SidebarNav userRole="publisher" />

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border md:hidden">
        <div className="h-full px-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/publisher")}
            className="hover:opacity-80 transition-opacity"
          >
            <Logo size="md" />
          </button>
          
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:pl-60">
        <div className="md:pt-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav userRole="publisher" />

      {/* Slide-out menu (kept for mobile hamburger fallback) */}
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userRole="publisher"
      />
    </div>
  );
};