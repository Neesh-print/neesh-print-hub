import { useCart } from "@/components/retailer";

export const CartSidebarBadge = () => {
  const { cartItemCount } = useCart();

  if (cartItemCount === 0) return null;

  return (
    <span className="ml-auto min-w-[20px] h-[20px] flex items-center justify-center bg-accent text-accent-foreground text-xs font-medium rounded-full px-1.5 animate-in zoom-in duration-200">
      {cartItemCount > 99 ? '99+' : cartItemCount}
    </span>
  );
};
