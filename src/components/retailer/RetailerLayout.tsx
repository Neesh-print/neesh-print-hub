import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/neesh";
import { useCart } from "./CartContext";

interface RetailerLayoutProps {
  children: ReactNode;
}

export const RetailerLayout = ({ children }: RetailerLayoutProps) => {
  const navigate = useNavigate();
  const { cartItemCount } = useCart();

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        userRole="retailer"
        showCart
        cartItemCount={cartItemCount}
        onMenuClick={() => {}}
        onCartClick={() => navigate("/retailer/cart")}
        onLogoClick={() => navigate("/retailer")}
      />
      <main className="pt-16">
        {children}
      </main>
    </div>
  );
};
