import { Menu, ShoppingCart } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import type { OrderNotification } from "@/hooks/useOrderNotifications";

export interface HeaderBarProps {
  userRole: 'publisher' | 'retailer' | 'admin';
  showCart?: boolean;
  cartItemCount?: number;
  onMenuClick: () => void;
  onCartClick?: () => void;
  onLogoClick: () => void;
  // Notification props for publishers
  notifications?: OrderNotification[];
  unreadCount?: number;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (orderId: string) => void;
}

export const HeaderBar = ({
  userRole,
  showCart = false,
  cartItemCount = 0,
  onMenuClick,
  onCartClick,
  onLogoClick,
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
}: HeaderBarProps) => {
  const shouldShowCart = showCart || userRole === 'retailer';
  const shouldShowNotifications = userRole === 'publisher';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background border-b border-border">
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={onLogoClick}
          className="font-display font-bold text-xl tracking-tight text-foreground hover:opacity-80 transition-opacity"
        >
          NEESH
        </button>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Notifications (publishers only) */}
          {shouldShowNotifications && onMarkAsRead && onMarkAllAsRead && (
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onNotificationClick={onNotificationClick}
            />
          )}

          {/* Cart (retailers only) */}
          {shouldShowCart && onCartClick && (
            <button
              onClick={onCartClick}
              className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label={`Shopping cart${cartItemCount > 0 ? `, ${cartItemCount} items` : ''}`}
            >
              <ShoppingCart className="w-5 h-5 text-foreground" />
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-accent text-accent-foreground text-[10px] font-medium rounded-full px-1">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>
          )}

          {/* Menu */}
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};
