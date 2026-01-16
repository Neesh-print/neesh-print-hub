import { X, LayoutDashboard, ShoppingBag, Package, Receipt, MessageSquare, User, LogOut, Store, ShoppingCart, Users, FileText, BarChart3, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface NavigationMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'publisher' | 'retailer' | 'admin';
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

export const NavigationMenu = ({ isOpen, onClose, userRole }: NavigationMenuProps) => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const publisherMenuItems: MenuItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, path: "/publisher" },
    { label: "My Orders", icon: <Package className="w-5 h-5" />, path: "/publisher/orders" },
    { label: "My Titles", icon: <ShoppingBag className="w-5 h-5" />, path: "/publisher/titles" },
    { label: "Transactions", icon: <Receipt className="w-5 h-5" />, path: "/publisher/transactions" },
    { label: "Messages", icon: <MessageSquare className="w-5 h-5" />, path: "/publisher/messages" },
    { label: "Profile", icon: <User className="w-5 h-5" />, path: "/publisher/profile" },
    { label: "Settings", icon: <Settings className="w-5 h-5" />, path: "/publisher/settings" },
  ];

  const retailerMenuItems: MenuItem[] = [
    { label: "Browse Catalogue", icon: <Store className="w-5 h-5" />, path: "/retailer" },
    { label: "My Orders", icon: <Package className="w-5 h-5" />, path: "/retailer/orders" },
    { label: "My Cart", icon: <ShoppingCart className="w-5 h-5" />, path: "/retailer/cart" },
    { label: "Profile", icon: <User className="w-5 h-5" />, path: "/retailer/profile" },
    { label: "Settings", icon: <Settings className="w-5 h-5" />, path: "/retailer/settings" },
  ];

  const adminMenuItems: MenuItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, path: "/admin" },
    { label: "Applications", icon: <FileText className="w-5 h-5" />, path: "/admin/applications" },
    { label: "Publishers", icon: <Users className="w-5 h-5" />, path: "/admin/publishers" },
    { label: "Retailers", icon: <Store className="w-5 h-5" />, path: "/admin/retailers" },
    { label: "Orders", icon: <Package className="w-5 h-5" />, path: "/admin/orders" },
    { label: "Analytics", icon: <BarChart3 className="w-5 h-5" />, path: "/admin/analytics" },
    { label: "Settings", icon: <Settings className="w-5 h-5" />, path: "/admin/settings" },
  ];

  const menuItems = userRole === 'publisher' 
    ? publisherMenuItems 
    : userRole === 'retailer' 
      ? retailerMenuItems 
      : adminMenuItems;

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Slide-out menu */}
      <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-background z-50 shadow-xl transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <p className="font-medium text-foreground">{profile?.full_name || profile?.business_name || 'User'}</p>
              <p className="text-sm text-muted-foreground capitalize">{userRole}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu items */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleNavigate(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sign out */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
