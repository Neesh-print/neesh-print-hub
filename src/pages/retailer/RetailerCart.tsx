import { useNavigate } from "react-router-dom";
import { X, ShoppingBag } from "lucide-react";
import { RetailerLayout, QuantitySelector, useCart } from "@/components/retailer";
import { BackNavigation, ButtonPrimary, ButtonSecondary, EmptyState } from "@/components/neesh";

export const RetailerCart = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, cartTotal, cartItemCount } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  if (cartItems.length === 0) {
    return (
      <RetailerLayout>
        <BackNavigation
          title="My Cart"
          onBack={() => navigate("/retailer")}
        />
        <div className="px-4 md:px-6 py-12">
          <EmptyState
            icon={<ShoppingBag className="w-12 h-12" />}
            title="Your cart is empty"
            description="Add magazines from the catalogue to get started"
            action={
              <ButtonPrimary onClick={() => navigate("/retailer")}>
                Browse Catalogue
              </ButtonPrimary>
            }
          />
        </div>
      </RetailerLayout>
    );
  }

  return (
    <RetailerLayout>
      <BackNavigation
        title="My Cart"
        onBack={() => navigate("/retailer")}
      />

      <div className="px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item, index) => (
              <div key={item.magazineId}>
                <div className="flex gap-4 py-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-28 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display font-semibold text-foreground line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.publisher} {item.issue && `· ${item.issue}`}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.magazineId)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Remove item"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <QuantitySelector
                        value={item.quantity}
                        onChange={(qty) => updateQuantity(item.magazineId, qty)}
                        min={1}
                      />
                      <p className="font-display font-semibold text-foreground">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </div>
                {index < cartItems.length - 1 && (
                  <div className="border-b border-border" />
                )}
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <div className="card-neesh sticky top-20">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Order Summary
              </h2>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({cartItemCount} items)</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="text-sm">Calculated at checkout</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mb-6">
                <div className="flex justify-between font-display font-semibold text-lg text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <ButtonPrimary fullWidth onClick={() => navigate("/retailer/checkout")}>
                  Proceed to Checkout
                </ButtonPrimary>
                <ButtonSecondary fullWidth onClick={() => navigate("/retailer")}>
                  Continue Shopping
                </ButtonSecondary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RetailerLayout>
  );
};
