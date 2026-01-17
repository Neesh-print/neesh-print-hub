import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, 
  BookOpen, 
  Package, 
  Receipt, 
  MessageSquare, 
  User, 
  Settings, 
  LogOut,
  Search,
  ShoppingCart,
  Heart,
  ShoppingBag,
  Store,
  Users,
  FileText,
  BarChart3,
  Truck
} from "lucide-react";

interface SidebarNavProps {
  userRole: 'publisher' | 'retailer' | 'admin';
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

export const SidebarNav = ({ userRole }: SidebarNavProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const publisherNavItems: NavItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, path: "/publisher" },
    { label: "My Titles", icon: <BookOpen className="w-5 h-5" />, path: "/publisher/titles" },
    { label: "Orders", icon: <Package className="w-5 h-5" />, path: "/publisher/orders" },
    { label: "Analytics", icon: <BarChart3 className="w-5 h-5" />, path: "/publisher/analytics" },
    { label: "Transactions", icon: <Receipt className="w-5 h-5" />, path: "/publisher/transactions" },
    { label: "Messages", icon: <MessageSquare className="w-5 h-5" />, path: "/publisher/messages" },
  ];

  const publisherSecondaryItems: NavItem[] = [
    { label: "Profile", icon: <User className="w-5 h-5" />, path: "/publisher/profile" },
    { label: "Settings", icon: <Settings className="w-5 h-5" />, path: "/publisher/settings" },
  ];

  const retailerNavItems: NavItem[] = [
    { label: "Browse Catalogue", icon: <Search className="w-5 h-5" />, path: "/retailer" },
    { label: "Saved Titles", icon: <Heart className="w-5 h-5" />, path: "/retailer/wishlist" },
    { label: "My Orders", icon: <Package className="w-5 h-5" />, path: "/retailer/orders" },
    { label: "Cart", icon: <ShoppingCart className="w-5 h-5" />, path: "/retailer/cart" },
  ];

  const retailerSecondaryItems: NavItem[] = [
    { label: "Profile", icon: <User className="w-5 h-5" />, path: "/retailer/profile" },
    { label: "Settings", icon: <Settings className="w-5 h-5" />, path: "/retailer/settings" },
  ];

  const adminNavItems: NavItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, path: "/admin" },
    { label: "Fulfillment", icon: <Truck className="w-5 h-5" />, path: "/admin/fulfillment" },
    { label: "Applications", icon: <FileText className="w-5 h-5" />, path: "/admin/applications" },
    { label: "Publishers", icon: <Users className="w-5 h-5" />, path: "/admin/publishers" },
    { label: "Retailers", icon: <Store className="w-5 h-5" />, path: "/admin/retailers" },
    { label: "Orders", icon: <ShoppingBag className="w-5 h-5" />, path: "/admin/orders" },
    { label: "Analytics", icon: <BarChart3 className="w-5 h-5" />, path: "/admin/analytics" },
  ];

  const adminSecondaryItems: NavItem[] = [
    { label: "Settings", icon: <Settings className="w-5 h-5" />, path: "/admin/settings" },
  ];

  const navItems = userRole === 'publisher' 
    ? publisherNavItems 
    : userRole === 'retailer' 
      ? retailerNavItems 
      : adminNavItems;

  const secondaryItems = userRole === 'publisher'
    ? publisherSecondaryItems
    : userRole === 'retailer'
      ? retailerSecondaryItems
      : adminSecondaryItems;

  const isActive = (path: string) => {
    if (path === '/publisher' || path === '/retailer' || path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 flex-col bg-background border-r border-border z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <button
          onClick={() => navigate(`/${userRole}`)}
          className="font-display font-bold text-xl tracking-tight text-foreground hover:opacity-80 transition-opacity"
        >
          NEESH
        </button>
      </div>

      {/* Main nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors text-left
                    ${active 
                      ? 'bg-secondary text-accent' 
                      : 'text-foreground hover:bg-secondary/50'
                    }
                  `}
                >
                  <span className={active ? 'text-accent' : 'text-muted-foreground'}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Secondary items */}
        <div className="mt-6 pt-6 border-t border-border">
          <ul className="space-y-1">
            {secondaryItems.map((item) => {
              const active = isActive(item.path);
              return (
                <li key={item.path}>
                  <button
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-colors text-left
                      ${active 
                        ? 'bg-secondary text-accent' 
                        : 'text-foreground hover:bg-secondary/50'
                      }
                    `}
                  >
                    <span className={active ? 'text-accent' : 'text-muted-foreground'}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* User info and sign out */}
      <div className="p-4 border-t border-border">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-foreground truncate">
            {profile?.full_name || profile?.business_name || 'User'}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};