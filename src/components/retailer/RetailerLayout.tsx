import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/neesh";
import { NavigationMenu } from "@/components/shared";
import { useCart } from "./CartContext";

interface RetailerLayoutProps {
  children: ReactNode;
}

export const RetailerLayout = ({ children }: RetailerLayoutProps) => {
  const navigate = useNavigate();
  const { cartItemCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        userRole="retailer"
        showCart
        cartItemCount={cartItemCount}
        onMenuClick={() => setIsMenuOpen(true)}
        onCartClick={() => navigate("/retailer/cart")}
        onLogoClick={() => navigate("/retailer")}
      />
      <main className="pt-16">
        {children}
      </main>
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userRole="retailer"
      />
    </div>
  );
};
