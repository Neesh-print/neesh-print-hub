import { useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  BookOpen, 
  Package, 
  User, 
  Search, 
  ShoppingCart, 
  Truck, 
  Menu 
} from "lucide-react";

interface NavTab {
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

interface MobileBottomNavProps {
  userRole: 'publisher' | 'retailer' | 'admin';
  cartItemCount?: number;
  onMoreClick?: () => void;
}

export const MobileBottomNav = ({ 
  userRole, 
  cartItemCount = 0,
  onMoreClick 
}: MobileBottomNavProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const publisherTabs: NavTab[] = [
    { label: "Home", icon: <LayoutDashboard className="w-5 h-5" />, path: "/publisher" },
    { label: "Titles", icon: <BookOpen className="w-5 h-5" />, path: "/publisher/titles" },
    { label: "Orders", icon: <Package className="w-5 h-5" />, path: "/publisher/orders" },
    { label: "Profile", icon: <User className="w-5 h-5" />, path: "/publisher/profile" },
  ];

  const retailerTabs: NavTab[] = [
    { label: "Browse", icon: <Search className="w-5 h-5" />, path: "/retailer" },
    { label: "Orders", icon: <Package className="w-5 h-5" />, path: "/retailer/orders" },
    { label: "Cart", icon: <ShoppingCart className="w-5 h-5" />, path: "/retailer/cart", badge: cartItemCount },
    { label: "Profile", icon: <User className="w-5 h-5" />, path: "/retailer/profile" },
  ];

  const adminTabs: NavTab[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, path: "/admin" },
    { label: "Orders", icon: <Package className="w-5 h-5" />, path: "/admin/orders" },
    { label: "Fulfillment", icon: <Truck className="w-5 h-5" />, path: "/admin/fulfillment" },
  ];

  const tabs = userRole === 'publisher' 
    ? publisherTabs 
    : userRole === 'retailer' 
      ? retailerTabs 
      : adminTabs;

  const isActive = (path: string) => {
    if (path === '/publisher' || path === '/retailer' || path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleTabClick = (path: string) => {
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div 
        className="h-16 flex items-center justify-around px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => handleTabClick(tab.path)}
              className={`
                flex flex-col items-center justify-center gap-1 
                min-w-[64px] min-h-[44px] px-2 py-1.5
                transition-colors
                ${active ? 'text-accent' : 'text-muted-foreground'}
              `}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] flex items-center justify-center bg-accent text-accent-foreground text-[10px] font-medium rounded-full px-1">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
        
        {/* Admin has a "More" button */}
        {userRole === 'admin' && onMoreClick && (
          <button
            onClick={onMoreClick}
            className="flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] px-2 py-1.5 text-muted-foreground transition-colors"
            aria-label="More options"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        )}
      </div>
    </nav>
  );
};