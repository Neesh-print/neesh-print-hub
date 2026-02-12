import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { NavigationMenu, MobileBottomNav, SidebarNav, NotificationCenter } from "@/components/shared";
import { useCart } from "./CartContext";
import { useWishlistContext } from "./WishlistContext";
import { Logo } from "@/components/neesh/Logo";

interface RetailerLayoutProps {
  children: ReactNode;
}

export const RetailerLayout = ({ children }: RetailerLayoutProps) => {
  const navigate = useNavigate();
  const { cartItemCount } = useCart();
  const { wishlistCount } = useWishlistContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <SidebarNav userRole="retailer" />

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border md:hidden">
        <div className="h-full px-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/retailer")}
            className="hover:opacity-80 transition-opacity"
          >
            <Logo size="md" />
          </button>
          
          <div className="flex items-center gap-2">
            <NotificationCenter userRole="retailer" />
            <button
              onClick={() => navigate("/retailer/cart")}
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
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:pl-60">
        {/* Desktop top bar with notifications */}
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b border-border">
          <NotificationCenter userRole="retailer" />
        </div>
        <div className="md:pt-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        userRole="retailer" 
        cartItemCount={cartItemCount} 
        wishlistCount={wishlistCount}
      />

      {/* Slide-out menu (kept for mobile hamburger fallback) */}
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userRole="retailer"
      />
    </div>
  );
};