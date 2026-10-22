import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RetailerLayout, useCart } from "@/components/retailer";
import { BackNavigation, ButtonPrimary } from "@/components/neesh";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Lock, MailWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { useShippingV2 } from "@/hooks/useShippingV2";
import { useShippingQuote } from "@/hooks/useShippingQuote";
import { useShippingAddress } from "@/hooks/useShippingAddress";
import { calculateRetailerPrice } from "@/utils/pricing";
import { round2 } from "@/lib/shipping";

export const RetailerCheckout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartItems, clearCart } = useCart();
  const { isVerified, isResending, resend, refetch } = useEmailVerification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { enabled: shippingV2 } = useShippingV2();
  const { address } = useShippingAddress();
  const quote = useShippingQuote(
    cartItems.map((i) => ({ magazine_id: i.magazineId, quantity: i.quantity })),
    { enabled: shippingV2 && cartItems.length > 0, addressKey: address ? `${address.id}:${address.updated_at}` : "none" },
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Spaces pay WSP x 1.10. Shipping comes from the live quote (shipping_v2);
  // tax is calculated by Stripe automatic tax at payment.
  const subtotal = round2(cartItems.reduce((sum, item) => sum + calculateRetailerPrice(item.price) * item.quantity, 0));
  const groups = quote.data?.groups ?? [];
  const shippingBlocked = shippingV2 && (quote.data?.status !== "ok" || groups.some((g) => !g.can_ship));
  const shippingCost = shippingV2 ? round2(groups.reduce((sum, g) => sum + (g.shipping_usd ?? 0), 0)) : null;
  const total = subtotal + (shippingCost ?? 0);

  const handleResend = async () => {
    const sent = await resend();
    if (sent) {
      toast({
        title: "Confirmation email sent",
        description: "Check your inbox and click the link — then come back here.",
      });
    } else {
      toast({
        title: "Couldn't send the email",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerified === false) {
      toast({
        title: "Confirm your email first",
        description: "Click the confirmation link we emailed you to place your first order.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);

    try {
      // Construct payload for Edge Function
      const cart_items = cartItems.map((item) => ({
        magazine_id: item.magazineId,
        quantity: item.quantity,
      }));

      // Invoke the create-checkout Edge Function
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          cart_items,
          ...(shippingV2 ? { quote_ids: groups.map((g) => g.quote_id).filter(Boolean) } : {}),
        },
      });

      if (error) {
        console.error('Checkout error:', error);
        let title = "Checkout failed";
        let description = error.message || "Unable to create checkout session. Please try again.";
        // Surface the server-side email gate specifically (e.g. if this tab's
        // verification state was stale) and re-sync the banner.
        if ("context" in error && error.context instanceof Response) {
          try {
            const body = await error.context.json();
            if (body?.code === 'email_unverified') {
              title = "Confirm your email first";
              refetch();
            }
            if (body?.error) description = body.error;
          } catch {
            // keep the generic message
          }
        }
        toast({ title, description, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      // Check for business logic errors from the Edge Function
      if (!data?.success || !data?.checkout_url) {
        const errorMessage = data?.error || "Invalid response from checkout service";
        toast({
          title: "Checkout failed",
          description: errorMessage,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Success! Redirect to Stripe Checkout
      // Cart is cleared on the order confirmation page after Stripe redirects back
      window.location.href = data.checkout_url;

    } catch (err) {
      console.error('Unexpected checkout error:', err);
      toast({
        title: "Checkout failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    navigate("/retailer/cart");
    return null;
  }

  return (
    <RetailerLayout>
      <BackNavigation
        title="Checkout"
        onBack={() => navigate("/retailer/cart")}
      />

      <form onSubmit={handleSubmit} className="px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Shipping address: set and changed in the cart, where shipping is quoted */}
            <section className="card-neesh">
              <h2 className="font-display font-semibold text-lg text-foreground mb-2">
                Shipping Address
              </h2>
              {address ? (
                <p className="text-sm text-muted-foreground">
                  {address.recipient_name}, {address.address_line_1}
                  {address.address_line_2 ? `, ${address.address_line_2}` : ""}, {address.city}, {address.state} {address.postal_code}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No shipping address yet.</p>
              )}
              <button
                type="button"
                onClick={() => navigate("/retailer/cart")}
                className="text-sm font-medium text-accent hover:underline mt-2"
              >
                Change in cart
              </button>
            </section>

            {/* Payment - PCI-Compliant Placeholder */}
            <section className="card-neesh">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Payment
              </h2>
              
              {/* Secure Payment Notice */}
              <div className="bg-secondary/50 border border-border rounded-lg p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-accent" />
                  </div>
                </div>
                
                <h3 className="font-display font-semibold text-foreground mb-2">
                  Secure Payment Processing
                </h3>
                
                <p className="text-sm text-muted-foreground mb-4">
                  Payment will be processed securely through Stripe. 
                  Your card details are never stored on our servers.
                </p>
                
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  <span>256-bit SSL encryption</span>
                </div>
              </div>
            </section>

            {isVerified === false && (
              <section className="card-neesh border border-accent/40 bg-accent/5">
                <div className="flex items-start gap-3">
                  <MailWarning className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-display font-semibold text-foreground mb-1">
                      Confirm your email to place your first order
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      We sent a confirmation link to{" "}
                      <span className="font-medium text-foreground">{user?.email}</span>.
                      Click it and come back here — no reload needed.
                    </p>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending}
                      className="text-sm font-medium text-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isResending ? "Sending…" : "Resend confirmation email"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            <ButtonPrimary type="submit" fullWidth loading={isSubmitting} disabled={isVerified === false || shippingBlocked}>
              Place Order
            </ButtonPrimary>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="card-neesh sticky top-20">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Order Summary
              </h2>

              {/* Items */}
              <div className="space-y-3 mb-4">
                {cartItems.map((item) => (
                  <div key={item.magazineId} className="flex gap-3">
                    <div className="w-12 h-16 rounded overflow-hidden bg-secondary flex-shrink-0">
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">{formatPrice(calculateRetailerPrice(item.price) * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Shipping</span>
                  <span>
                    {!shippingV2
                      ? "Calculated at payment"
                      : shippingBlocked
                        ? "See cart"
                        : quote.isLoading ? "Quoting..." : formatPrice(shippingCost ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span>Calculated at payment</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <div className="flex justify-between font-display font-bold text-lg text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </RetailerLayout>
  );
};
