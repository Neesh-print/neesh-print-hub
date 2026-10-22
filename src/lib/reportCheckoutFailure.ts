import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/components/retailer/CartContext";

/**
 * Records a failed checkout so the team is emailed right away
 * (see the checkout_failures table and its notify trigger).
 *
 * Writes straight to the database rather than through an edge function,
 * so it still works when the checkout function itself can't be reached.
 * Never throws: reporting must not get in the way of the buyer.
 */
export async function reportCheckoutFailure(params: {
  source: "cart" | "checkout";
  cartItems: CartItem[];
  cartTotal: number;
  errorMessage?: string;
  errorCode?: string;
}) {
  try {
    await supabase
      // Table is newer than the generated types.
      .from("checkout_failures" as never)
      .insert({
        source: params.source,
        error_code: params.errorCode ?? null,
        error_message: (params.errorMessage ?? "").slice(0, 1000),
        cart: params.cartItems.map((i) => ({ title: i.title, quantity: i.quantity })),
        cart_total: Math.round(params.cartTotal * 100) / 100,
        user_agent: navigator.userAgent.slice(0, 300),
      } as never);
  } catch (e) {
    console.error("Could not report checkout failure:", e);
  }
}

/** Added to the buyer-facing error so they wait for us instead of leaving. */
export const CHECKOUT_FAILURE_FOLLOW_UP =
  " We've been notified and will email you shortly to complete your order.";
