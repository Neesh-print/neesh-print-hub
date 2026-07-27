import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { X, ShoppingBag, Loader2, CalendarClock } from "lucide-react";
import { RetailerLayout, QuantitySelector, useCart } from "@/components/retailer";
import { BackNavigation, ButtonPrimary, ButtonSecondary, EmptyState } from "@/components/neesh";
import { calculateRetailerPrice } from "@/utils/pricing";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRetailerCredit } from "@/hooks/useRetailerCredit";

type PaymentMethod = "pay_now" | "net14" | "net30";

export const RetailerCart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pay_now");
  const { cartItems, removeFromCart, updateQuantity, cartItemCount } = useCart();
  const { credit } = useRetailerCredit();

  const retailerTotal = cartItems.reduce((acc, item) => {
    return acc + (calculateRetailerPrice(item.price) * item.quantity);
  }, 0);

  // Which net-terms options this retailer may use (approved days and within credit).
  const termsOptions: { value: PaymentMethod; label: string; days: number }[] = [];
  if (credit?.termsEnabled) {
    if (credit.netTermsDays >= 14) termsOptions.push({ value: "net14", label: "Net 14", days: 14 });
    if (credit.netTermsDays >= 30) termsOptions.push({ value: "net30", label: "Net 30", days: 30 });
  }
  const exceedsCredit = !!credit?.termsEnabled && retailerTotal > credit.available;

  // Extract a friendly error message from a Supabase edge-function error.
  const extractError = async (error: unknown): Promise<string> => {
    const err = error as { context?: { json?: () => Promise<{ error?: string }> }; message?: string };
    if (err?.context?.json) {
      try {
        const body = await err.context.json();
        if (body?.error) return body.error;
      } catch { /* ignore */ }
    }
    return err?.message || "Please try again later.";
  };

  const handleNetOrder = async (termsDays: number) => {
    try {
      setIsCheckingOut(true);
      const { data, error } = await supabase.functions.invoke('create-net-order', {
        body: {
          cart_items: cartItems.map(item => ({
            magazine_id: item.magazineId,
            quantity: item.quantity,
          })),
          terms_days: termsDays,
        },
      });
      if (error) throw error;
      if (!data?.invoice_id) throw new Error('No invoice was created');

      toast({
        title: `Order placed on Net ${termsDays}`,
        description: "We've emailed you an invoice. You can pay it any time before the due date.",
      });
      navigate('/retailer/invoices');
    } catch (error) {
      toast({
        title: "Could not place order on terms",
        description: await extractError(error),
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCheckout = async () => {
    if (paymentMethod === "net14") return handleNetOrder(14);
    if (paymentMethod === "net30") return handleNetOrder(30);
    try {
      setIsCheckingOut(true);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          cart_items: cartItems.map(item => ({
            magazine_id: item.magazineId,
            quantity: item.quantity
          }))
        }
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      
      let errorMessage = "Please try again later.";
      
      // Try to extract message, checking for edge function error body
      if (error?.context?.json) {
        try {
           const errorBody = await error.context.json();
           if (errorBody?.error) {
             errorMessage = errorBody.error;
           }
        } catch (e) {
          // invalid json, ignore
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Checkout failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

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
                        {formatPrice(calculateRetailerPrice(item.price) * item.quantity)}
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
                  <span>{formatPrice(retailerTotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="text-sm">Calculated at checkout</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mb-4">
                <div className="flex justify-between font-display font-semibold text-lg text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(retailerTotal)}</span>
                </div>
              </div>

              {/* Payment method — only shown to terms-approved retailers */}
              {credit?.termsEnabled && termsOptions.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-foreground">
                    <CalendarClock className="w-4 h-4" />
                    <span>Payment method</span>
                  </div>
                  <div className="space-y-2">
                    {[{ value: "pay_now" as PaymentMethod, label: "Pay now", days: 0 }, ...termsOptions].map((opt) => {
                      const disabled = opt.value !== "pay_now" && exceedsCredit;
                      const selected = paymentMethod === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => setPaymentMethod(opt.value)}
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                            selected ? "border-foreground bg-secondary" : "border-border hover:border-foreground/40"
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <span className="font-medium text-foreground">{opt.label}</span>
                          <span className="text-muted-foreground">
                            {opt.value === "pay_now" ? "Card / bank at checkout" : `Due in ${opt.days} days`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Available credit: {formatPrice(credit.available)}
                    {exceedsCredit && " — this order exceeds your credit; pay now or reduce the cart."}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <ButtonPrimary fullWidth onClick={handleCheckout} disabled={isCheckingOut}>
                  {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {paymentMethod === "pay_now"
                    ? "Proceed to Checkout"
                    : `Place order on ${paymentMethod === "net14" ? "Net 14" : "Net 30"}`}
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
