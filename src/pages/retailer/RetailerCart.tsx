import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ShoppingBag, Loader2 } from "lucide-react";
import { RetailerLayout, QuantitySelector, useCart } from "@/components/retailer";
import type { CartItem } from "@/components/retailer/CartContext";
import { BackNavigation, ButtonPrimary, ButtonSecondary, EmptyState, StatusBadge } from "@/components/neesh";
import { ShippingAddressForm } from "@/components/shipping";
import { calculateRetailerPrice } from "@/utils/pricing";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useShippingV2 } from "@/hooks/useShippingV2";
import { useShippingQuote, type QuoteGroup } from "@/hooks/useShippingQuote";
import { useShippingAddress, useSaveShippingAddress } from "@/hooks/useShippingAddress";
import { landedMargin, round2, type LandedMargin } from "@/lib/shipping";
import {
  MARGIN_BADGE_STATUS,
  blockedText,
  carrierLine,
  marginBandLabel,
  marginText,
  marginTextClass,
  money,
  shipsFromText,
  signedMoney,
} from "@/lib/shippingCopy";
import type { ShippingAddressSchemaType } from "@/lib/schemas/shipping-address";

interface CartMagazine {
  id: string;
  publisher_id: string;
  wholesale_price: number | null;
  suggested_retail_price: number | null;
  minimum_order_quantity: number | null;
  publishers: { company_name: string | null } | null;
}

/** Current publisher, retail price and minimum for each cart title. */
function useCartMagazines(ids: string[]) {
  return useQuery({
    queryKey: ["cart-magazines", [...ids].sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("magazines")
        .select("id, publisher_id, wholesale_price, suggested_retail_price, minimum_order_quantity, publishers ( company_name )")
        .in("id", ids);
      if (error) throw error;
      return new Map(((data ?? []) as unknown as CartMagazine[]).map((m) => [m.id, m]));
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

export const RetailerCart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const { cartItems, removeFromCart, updateQuantity, cartItemCount } = useCart();

  const { enabled: shippingV2 } = useShippingV2();
  const { address, isLoading: addressLoading } = useShippingAddress();
  const saveAddress = useSaveShippingAddress();
  const { data: magazines } = useCartMagazines(cartItems.map((i) => i.magazineId));

  const quote = useShippingQuote(
    cartItems.map((i) => ({ magazine_id: i.magazineId, quantity: i.quantity })),
    { enabled: shippingV2 && cartItems.length > 0, addressKey: address ? `${address.id}:${address.updated_at}` : "none" },
  );

  const retailerTotal = cartItems.reduce((acc, item) => acc + calculateRetailerPrice(item.price) * item.quantity, 0);
  const minFor = (item: CartItem) => Math.max(1, magazines?.get(item.magazineId)?.minimum_order_quantity ?? 1);

  // Group cart lines by publisher, in cart order (T5).
  const groups = useMemo(() => {
    const map = new Map<string, { publisherId: string; name: string; items: CartItem[] }>();
    for (const item of cartItems) {
      const mag = magazines?.get(item.magazineId);
      const pid = mag?.publisher_id ?? item.publisherId ?? `unknown:${item.publisher}`;
      if (!map.has(pid)) map.set(pid, { publisherId: pid, name: mag?.publishers?.company_name || item.publisher, items: [] });
      map.get(pid)!.items.push(item);
    }
    return [...map.values()];
  }, [cartItems, magazines]);

  const quoteGroups = new Map<string, QuoteGroup>((quote.data?.groups ?? []).map((g) => [g.publisher_id, g]));
  const needsAddress = shippingV2 && !addressLoading && (!address || quote.data?.status === "needs_address");

  const groupMargin = (items: CartItem[], shippingUsd: number | null): LandedMargin | null => {
    if (shippingUsd === null) return null;
    let revenue = 0;
    let goods = 0;
    for (const item of items) {
      const srp = Number(magazines?.get(item.magazineId)?.suggested_retail_price ?? 0);
      if (!srp) return null;
      revenue += srp * item.quantity;
      goods += item.price * item.quantity;
    }
    // Express the group as one "line" so the shared band rules apply.
    const qty = items.reduce((n, i) => n + i.quantity, 0);
    return landedMargin({ wsp: goods / qty, srp: revenue / qty, quantity: qty, shippingUsd });
  };

  const shippingTotal = round2(
    [...quoteGroups.values()].reduce((sum, g) => sum + (g.can_ship && g.shipping_usd !== null ? g.shipping_usd : 0), 0),
  );
  // US customs handling: its own line, beside shipping. 0 (no line) when off.
  const customsTotal = round2(
    [...quoteGroups.values()].reduce((sum, g) => sum + (g.can_ship ? Number(g.customs_usd ?? 0) : 0), 0),
  );
  const parcelCount = [...quoteGroups.values()].filter((g) => g.can_ship).length;
  const blockedGroups = [...quoteGroups.values()].filter((g) => !g.can_ship);
  const margins = groups.map((g) => {
    const q = quoteGroups.get(g.publisherId);
    // Customs handling is part of what the space pays to land the parcel.
    return groupMargin(g.items, q?.can_ship && q.shipping_usd !== null ? q.shipping_usd + Number(q.customs_usd ?? 0) : null);
  });
  const totalMargin = margins.every((m) => m !== null) ? round2(margins.reduce((s, m) => s + m!.margin, 0)) : null;

  const quoteReady = !shippingV2 || (!!quote.data && quote.data.status === "ok" && !quote.isFetching);
  const titleMinimumShort = cartItems.some((i) => i.quantity < minFor(i));
  const checkoutBlocked = titleMinimumShort || (shippingV2 && (needsAddress || !quoteReady || blockedGroups.length > 0 || quote.isError));

  const handleSaveAddress = async (data: ShippingAddressSchemaType) => {
    try {
      await saveAddress.mutateAsync({
        ...(data as Required<ShippingAddressSchemaType>),
        label: data.label || "",
        company_name: data.company_name || "",
        address_line_2: data.address_line_2 || "",
        phone: data.phone || "",
        delivery_instructions: data.delivery_instructions || "",
        is_default: true,
        id: address?.id,
      });
      setEditingAddress(false);
      queryClient.invalidateQueries({ queryKey: ["shipping-quote"] });
      toast({ title: "Address saved", description: "Shipping has been re-quoted." });
    } catch (err) {
      toast({ title: "Couldn't save address", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleCheckout = async () => {
    try {
      setIsCheckingOut(true);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          cart_items: cartItems.map(item => ({
            magazine_id: item.magazineId,
            quantity: item.quantity
          })),
          ...(shippingV2 ? { quote_ids: [...quoteGroups.values()].map((g) => g.quote_id).filter(Boolean) } : {}),
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
           if (errorBody?.code === 'shipping_blocked' || errorBody?.code === 'needs_address') {
             queryClient.invalidateQueries({ queryKey: ["shipping-quote"] });
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

  const renderItem = (item: CartItem, showDivider: boolean) => {
    const min = minFor(item);
    return (
      <div key={item.magazineId}>
        <div className={`flex gap-4 py-4 ${showDivider ? "border-t border-border" : ""}`}>
          <div className="w-20 h-28 rounded-md overflow-hidden bg-secondary flex-shrink-0">
            <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-semibold text-foreground line-clamp-1">{item.title}</h3>
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
                min={Math.min(min, item.quantity)}
              />
              <p className="font-display font-semibold text-foreground">
                {formatPrice(calculateRetailerPrice(item.price) * item.quantity)}
              </p>
            </div>
            {item.quantity < min && (
              <p className="text-xs text-status-pending-text mt-2">Minimum {min} copies of this title. Add {min - item.quantity} more.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroupShipping = (g: { publisherId: string; items: CartItem[] }, margin: LandedMargin | null) => {
    if (!shippingV2) return null;
    const q = quoteGroups.get(g.publisherId);
    if (needsAddress) return null;
    if (!q) {
      return (
        <div className="flex justify-between py-1 text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span className="text-muted-foreground">{quote.isError ? "Couldn't quote" : "Quoting..."}</span>
        </div>
      );
    }
    if (!q.can_ship) {
      return (
        <div className="rounded-lg px-4 py-3 bg-status-pending text-status-pending-text font-medium text-sm">
          {blockedText(q)}
        </div>
      );
    }
    return (
      <div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">
            Shipping · {carrierLine(q)}
            {q.estimated_days ? ` · about ${q.estimated_days} days` : ""}
          </span>
          <span>{q.shipping_usd !== null ? money(q.shipping_usd) : ""}</span>
        </div>
        {Number(q.customs_usd ?? 0) > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">US customs handling</span>
            <span>{money(Number(q.customs_usd))}</span>
          </div>
        )}
        {margin && (
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">My margin</span>
            <span className="inline-flex gap-2 items-center">
              <span className={`font-medium ${marginTextClass(margin.band)}`}>{marginText(margin)}</span>
              <StatusBadge status={MARGIN_BADGE_STATUS[margin.band]} label={marginBandLabel(margin.band)} />
            </span>
          </div>
        )}
      </div>
    );
  };

  const destination = quote.data?.destination;
  const destinationText = address
    ? [address.city, address.state].filter(Boolean).join(", ")
    : destination ? [destination.city, destination.state].filter(Boolean).join(", ") : "";

  return (
    <RetailerLayout>
      <BackNavigation
        title="My Cart"
        onBack={() => navigate("/retailer")}
      />

      <div className="px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            {shippingV2 && (needsAddress || editingAddress) && (
              <div className="card-neesh mb-6">
                <h2 className="font-display font-semibold text-lg text-foreground mb-1">
                  {address ? "Change your shipping address" : "Where should we ship?"}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Shipping is quoted live from each publisher to this address.
                </p>
                <ShippingAddressForm
                  initialData={address}
                  onSubmit={handleSaveAddress}
                  onCancel={() => setEditingAddress(false)}
                  isFirstAddress={!address}
                  isSubmitting={saveAddress.isPending}
                />
              </div>
            )}

            {shippingV2 ? (
              groups.map((g, gi) => {
                const q = quoteGroups.get(g.publisherId);
                return (
                  <div key={g.publisherId} className={gi > 0 ? "mt-4 pt-2 border-t border-border" : ""}>
                    <div className="flex justify-between items-center gap-3 pt-4 pb-2">
                      <span className="font-display font-semibold text-sm">{g.name}</span>
                      <span className="text-caption text-muted-foreground">
                        {q ? shipsFromText(q.origin_city, q.origin_country) : ""}
                      </span>
                    </div>
                    {g.items.map((item) => renderItem(item, true))}
                    {renderGroupShipping(g, margins[gi])}
                  </div>
                );
              })
            ) : (
              <div className="space-y-4">
                {cartItems.map((item, index) => (
                  <div key={item.magazineId}>
                    {renderItem(item, false)}
                    {index < cartItems.length - 1 && <div className="border-b border-border" />}
                  </div>
                ))}
              </div>
            )}
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
                  <span className="text-foreground">{formatPrice(retailerTotal)}</span>
                </div>
                {shippingV2 ? (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        Shipping
                        {parcelCount > 0 && ` (${parcelCount} ${parcelCount === 1 ? "parcel" : "parcels"}${blockedGroups.length > 0 ? " so far" : ""})`}
                      </span>
                      <span className="text-foreground">
                        {needsAddress ? "Add address" : quote.isLoading ? "Quoting..." : formatPrice(shippingTotal)}
                      </span>
                    </div>
                    {customsTotal > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>US customs handling</span>
                        <span className="text-foreground">{formatPrice(customsTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax</span>
                      <span className="text-sm">Calculated at checkout</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span className="text-sm">Calculated at checkout</span>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4 mb-2">
                <div className="flex justify-between font-display font-semibold text-lg text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(retailerTotal + (shippingV2 ? shippingTotal + customsTotal : 0))}</span>
                </div>
              </div>

              {shippingV2 && (
                <>
                  <div className="flex justify-between py-1 text-muted-foreground">
                    <span>My margin</span>
                    <span className="font-medium text-foreground">{totalMargin !== null && blockedGroups.length === 0 ? signedMoney(totalMargin) : "Not yet"}</span>
                  </div>
                  {address && !editingAddress && (
                    <p className="text-caption text-muted-foreground mt-2">
                      Shipping to {destinationText} ·{" "}
                      <button type="button" className="text-accent hover:underline" onClick={() => setEditingAddress(true)}>
                        Change
                      </button>
                    </p>
                  )}
                </>
              )}

              <div className="space-y-3 mt-4">
                <ButtonPrimary fullWidth onClick={handleCheckout} disabled={isCheckingOut || checkoutBlocked}>
                  {(isCheckingOut || (shippingV2 && quote.isFetching)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
