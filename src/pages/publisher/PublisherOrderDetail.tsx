import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Package, MessageCircle, Loader2, Printer } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, InfoCard, StatusBadge, ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { AddTrackingModal } from "@/components/admin/AddTrackingModal";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { useUpdateOrderStatus } from "@/hooks/useUpdateOrderStatus";
import { supabase } from "@/integrations/supabase/client";
import { parseShippingAddress, ShippingAddress } from "@/utils/parseShippingAddress";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CUSTOMS_DESCRIPTION, PACKAGING_OPTIONS, needsCustoms, senderPrepaysDuties } from "@/lib/shipping";
import { money } from "@/lib/shippingCopy";

interface OrderShipment {
  id: string;
  status: string;
  zone: string;
  origin_country: string | null;
  destination_country: string | null;
  copies: number;
  weight_grams: number | null;
  parcel: { packaging?: string; weightGrams?: number } | null;
  shipping_usd: number;
  rate_source: string;
  uses_neesh_labels: boolean;
  label_cost_usd: number | null;
  label_url: string | null;
  commercial_invoice_url: string | null;
  carrier: string | null;
  service: string | null;
  duties_paid: boolean;
  tracking_number: string | null;
  review_reason: string | null;
}

const packagingLabel = (p?: string) =>
  p === "padded_mailer" ? "Padded mailer" : PACKAGING_OPTIONS.find((o) => o.value === p)?.label ?? "Parcel";

interface OrderDetail {
  id: string;
  status: string;
  created_at: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tracking_number: string | null;
  carrier: string | null;
  shipping_address: ShippingAddress | null;
  shipment_id?: string | null;
  magazines: {
    id: string;
    title: string;
    cover_image_url: string | null;
    publisher_id: string;
  } | null;
  retailers: {
    shop_name: string | null;
    user_id: string;
  } | null;
}

export const PublisherOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { publisher } = usePublisherProfile();
  const { addTracking, isUpdating } = useUpdateOrderStatus();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  // Fetch order details
  useEffect(() => {
    if (!id || !publisher?.id) return;

    const fetchOrder = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            created_at,
            quantity,
            unit_price,
            total_price,
            tracking_number,
            carrier,
            shipping_address,
            shipment_id,
            retailer_id,
            magazines (
              id,
              title,
              cover_image_url,
              publisher_id
            )
          `)
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) {
          setError("Order not found");
          return;
        }

        // Fetch retailer info separately (retailer_id is a user_id, not retailers.id)
        let retailerInfo: { shop_name: string | null; user_id: string } | null = null;
        if (data.retailer_id) {
          const { data: retailer } = await supabase
            .from('retailers')
            .select('shop_name, user_id')
            .eq('user_id', data.retailer_id)
            .maybeSingle();
          retailerInfo = retailer;
        }

        const orderData: OrderDetail = {
          ...(data as any),
          shipping_address: parseShippingAddress((data as any).shipping_address),
          retailers: retailerInfo,
        };

        // Security check: Ensure this order belongs to the current publisher
        if (orderData.magazines?.publisher_id !== publisher.id) {
          setError("Unauthorized - This order does not belong to your publications");
          toast.error("You can only view orders for your own magazines");
          setTimeout(() => navigate('/publisher/orders'), 2000);
          return;
        }

        setOrder(orderData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch order');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id, publisher?.id, navigate]);

  // --- shipping_v2: the parcel this order ships in (T11) ---
  const queryClient = useQueryClient();
  const [isBuyingLabel, setIsBuyingLabel] = useState(false);
  const shipmentQuery = useQuery({
    queryKey: ["order-shipment", order?.shipment_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_shipments")
        .select("id, status, zone, origin_country, destination_country, copies, weight_grams, parcel, shipping_usd, rate_source, uses_neesh_labels, label_cost_usd, label_url, commercial_invoice_url, carrier, service, duties_paid, tracking_number, review_reason")
        .eq("id", order!.shipment_id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as OrderShipment | null;
    },
    enabled: !!order?.shipment_id,
  });
  const shipment = shipmentQuery.data ?? null;

  const callBuyLabel = async (action: "buy" | "refund") => {
    if (!shipment) return;
    setIsBuyingLabel(true);
    try {
      const { data, error } = await supabase.functions.invoke("buy-label", { body: { shipment_id: shipment.id, action } });
      if (error) {
        let message = "Couldn't create the label. Please try again.";
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const b = await ctx.json();
            if (b?.error) message = b.error;
          } catch {
            // keep generic message
          }
        }
        toast.error(message);
        return;
      }
      if (action === "refund") {
        toast.success("Label cancelled. Shippo will refund it.");
      } else if (data?.label_url) {
        window.open(data.label_url, "_blank", "noopener");
        if (data.commercial_invoice_url) window.open(data.commercial_invoice_url, "_blank", "noopener");
        toast.success(data.reprint ? "Label reopened" : "Label ready. Print it and drop off the parcel.");
      }
    } finally {
      setIsBuyingLabel(false);
      queryClient.invalidateQueries({ queryKey: ["order-shipment", order?.shipment_id] });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const handleMarkAsShipped = async (trackingData: { carrier: string; trackingNumber: string }) => {
    if (!order) return;

    const success = await addTracking(order.id, trackingData.carrier, trackingData.trackingNumber);
    
    if (success) {
      toast.success("Order marked as shipped!");
      setIsTrackingModalOpen(false);
      
      // Refresh order data
      const { data } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          quantity,
          unit_price,
          total_price,
          tracking_number,
          carrier,
          shipping_address,
          shipment_id,
          retailer_id,
          magazines (
            id,
            title,
            cover_image_url,
            publisher_id
          )
        `)
        .eq('id', order.id)
        .single();

      if (data) {
        let retailerInfo: { shop_name: string | null; user_id: string } | null = null;
        if (data.retailer_id) {
          const { data: retailer } = await supabase
            .from('retailers')
            .select('shop_name, user_id')
            .eq('user_id', data.retailer_id)
            .maybeSingle();
          retailerInfo = retailer;
        }
        setOrder({ ...(data as any), shipping_address: parseShippingAddress((data as any).shipping_address), retailers: retailerInfo });
      }
    } else {
      toast.error("Failed to update order");
    }
  };

  // Format shipping address for display
  const formatShippingAddress = (address: ShippingAddress | null) => {
    if (!address) {
      return <p className="text-muted-foreground italic">No shipping address on file for this order</p>;
    }

    const { name, address: addr } = address;
    return (
      <div className="space-y-1 text-caption">
        {name && <p className="font-medium text-foreground">{name}</p>}
        {addr?.line1 && <p className="text-muted-foreground">{addr.line1}</p>}
        {addr?.line2 && <p className="text-muted-foreground">{addr.line2}</p>}
        {(addr?.city || addr?.state || addr?.postal_code) && (
          <p className="text-muted-foreground">
            {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}
          </p>
        )}
        {addr?.country && <p className="text-muted-foreground">{addr.country}</p>}
      </div>
    );
  };

  // Extract carrier from order object
  const getCarrier = () => {
    return order?.carrier;
  };

  // Loading state
  if (isLoading) {
    return (
      <PublisherLayout>
        <BackNavigation
          title="Order Details"
          onBack={() => navigate("/publisher/orders")}
        />
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </PublisherLayout>
    );
  }

  // Error or unauthorized state
  if (error || !order) {
    return (
      <PublisherLayout>
        <BackNavigation
          title="Order Details"
          onBack={() => navigate("/publisher/orders")}
        />
        <div className="px-4 md:px-6 py-12 text-center">
          <p className="text-destructive mb-4">{error || "Order not found"}</p>
          <ButtonSecondary onClick={() => navigate("/publisher/orders")}>
            Back to Orders
          </ButtonSecondary>
        </div>
      </PublisherLayout>
    );
  }

  const displayOrderNumber = `#${order.id.slice(0, 8).toUpperCase()}`;
  const isShipped = order.status === 'shipped' || order.status === 'delivered';
  const canShip = order.status === 'paid' || order.status === 'pending';

  return (
    <PublisherLayout>
      <BackNavigation
        title={`Order ${displayOrderNumber}`}
        onBack={() => navigate("/publisher/orders")}
      />

      <div className="px-4 md:px-6 pb-8 space-y-6">
        {/* Top Info Cards Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <InfoCard title="Order Info">
            <div className="space-y-2 text-caption">
              <p><span className="text-muted-foreground">Order:</span> <span className="text-foreground">{displayOrderNumber}</span></p>
              <p><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{format(new Date(order.created_at), 'MMMM d, yyyy')}</span></p>
              <p><span className="text-muted-foreground">Time:</span> <span className="text-foreground">{format(new Date(order.created_at), 'h:mm a')}</span></p>
              <p><span className="text-muted-foreground">Volume:</span> <span className="text-foreground">{order.quantity} units</span></p>
            </div>
          </InfoCard>

          <InfoCard title="Pricing">
            <div className="space-y-2 text-caption">
              <p><span className="text-muted-foreground">Wholesale Price:</span> <span className="text-foreground">{formatPrice(order.unit_price)}</span></p>
              <p><span className="text-muted-foreground">Quantity:</span> <span className="text-foreground">{order.quantity}</span></p>
              <p className="font-medium"><span className="text-muted-foreground">Total Revenue:</span> <span className="text-foreground">{formatPrice(order.total_price)}</span></p>
              {shipment && (
                <p><span className="text-muted-foreground">Shipping Paid:</span> <span className="text-foreground">{formatPrice(Number(shipment.shipping_usd))}</span></p>
              )}
            </div>
          </InfoCard>

          <InfoCard title="Status">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-caption text-muted-foreground">Payment:</span>
                <StatusBadge 
                  status={order.status === 'paid' || order.status === 'shipped' ? 'payment-received' : 'payment-pending'} 
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-caption text-muted-foreground">Fulfillment:</span>
                <StatusBadge status={order.status as 'pending' | 'shipped' | 'delivered' | 'cancelled'} />
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Retailer">
            <div className="space-y-2 text-caption">
              <p><span className="text-muted-foreground">Shop:</span> <span className="text-foreground">{order.retailers?.shop_name || 'Unknown Retailer'}</span></p>
            </div>
            <div className="mt-3 pt-3 border-t">
              <p className="text-caption text-muted-foreground mb-2">Shipping Address:</p>
              {formatShippingAddress(order.shipping_address)}
            </div>
          </InfoCard>
        </div>

        {/* Magazine Line Item Card, with the parcel's Shipping Label card beside it */}
        <div className={shipment ? "grid md:grid-cols-2 gap-6 items-start" : ""}>
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Order Item</h3>
          <div className="flex items-center gap-4">
            {order.magazines?.cover_image_url && (
              <img
                src={order.magazines.cover_image_url}
                alt={order.magazines.title}
                className="w-20 h-28 object-cover rounded bg-secondary"
              />
            )}
            <div>
              <h4 className="font-display font-semibold text-body text-foreground">{order.magazines?.title || 'Unknown Magazine'}</h4>
              <p className="text-caption text-muted-foreground mt-1">Qty: {order.quantity} units</p>
              <p className="text-caption text-foreground mt-1">{formatPrice(order.unit_price)} per unit</p>
            </div>
          </div>
        </div>

        {shipment && (
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-lg mb-4">
              {shipment.uses_neesh_labels ? "Shipping Label" : "Shipping"}
            </h3>
            <div className="space-y-1 text-body">
              {shipment.carrier && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Carrier</span>
                  <span>{shipment.carrier}{shipment.duties_paid ? ", duties paid" : ""}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Parcel</span>
                <span>
                  {packagingLabel(shipment.parcel?.packaging)}
                  {shipment.parcel?.weightGrams ? `, ${(shipment.parcel.weightGrams / 1000).toFixed(2)} kg` : ""}
                  {` · ${shipment.copies} ${shipment.copies === 1 ? "copy" : "copies"}`}
                </span>
              </div>
              {shipment.origin_country && shipment.destination_country && needsCustoms(shipment.origin_country, shipment.destination_country) && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Customs</span>
                  <span>{CUSTOMS_DESCRIPTION}, 4902.90</span>
                </div>
              )}
              {senderPrepaysDuties(shipment.origin_country, shipment.destination_country, shipment.duties_paid) && (
                <p className="text-caption text-status-pending-text py-1">
                  Prepay US duties before you post this. Since August 2025, postal parcels into the US need duties paid by the sender (Canada Post asks for a Zonos Declaration ID). Couriers such as UPS, FedEx and DHL Express handle this for you.
                </p>
              )}
              {shipment.uses_neesh_labels ? (
                <>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Label</span>
                    <span>{shipment.label_cost_usd !== null ? money(Number(shipment.label_cost_usd)) : "Not printed yet"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Paid by space</span>
                    <span>{money(Number(shipment.shipping_usd))}</span>
                  </div>
                  <div className="flex justify-between pt-3 mt-2 border-t border-border font-display font-semibold">
                    <span>You pay</span>
                    <span>{money(Math.max(0, Number(shipment.label_cost_usd ?? 0) - Number(shipment.shipping_usd)))}</span>
                  </div>
                  {shipment.tracking_number && (
                    <p className="text-caption text-muted-foreground pt-2">Tracking {shipment.tracking_number}</p>
                  )}
                  {shipment.status === "needs_review" && (
                    <p className="text-caption text-status-pending-text pt-2">
                      The label price changed since the order. Neesh is sorting it out; you don't need to do anything.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Shipping paid by the space</span>
                  <span>{money(Number(shipment.shipping_usd))}, paid to you</span>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Tracking Info (if shipped) */}
        {isShipped && order.tracking_number && (
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Shipping Information</h3>
            <div className="space-y-2 text-caption">
              <p><span className="text-muted-foreground">Tracking Number:</span> <span className="text-foreground font-medium">{order.tracking_number}</span></p>
              {getCarrier() && (
                <p><span className="text-muted-foreground">Carrier:</span> <span className="text-foreground">{getCarrier()}</span></p>
              )}
              <p><span className="text-muted-foreground">Status:</span> <span className="text-foreground">Shipped</span></p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`grid gap-4 ${shipment?.uses_neesh_labels ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {shipment?.uses_neesh_labels && shipment.status !== "cancelled" && (
            <ButtonPrimary
              fullWidth
              onClick={() => callBuyLabel("buy")}
              disabled={isBuyingLabel || shipment.status === "needs_review"}
              icon={isBuyingLabel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            >
              Print Label
            </ButtonPrimary>
          )}
          {canShip && (
            shipment?.uses_neesh_labels ? (
              <ButtonSecondary
                fullWidth
                disabled={!shipment.tracking_number || isUpdating}
                onClick={() => handleMarkAsShipped({ carrier: shipment.carrier || "", trackingNumber: shipment.tracking_number! })}
                icon={<Package className="w-4 h-4" />}
              >
                Mark as Shipped
              </ButtonSecondary>
            ) : (
              <ButtonPrimary
                fullWidth
                onClick={() => setIsTrackingModalOpen(true)}
                icon={<Package className="w-4 h-4" />}
              >
                Mark as Shipped
              </ButtonPrimary>
            )
          )}

          <ButtonSecondary
            fullWidth
            onClick={() => navigate('/publisher/messages')}
            icon={<MessageCircle className="w-4 h-4" />}
          >
            Contact Retailer
          </ButtonSecondary>
        </div>
      </div>

      {shipment?.uses_neesh_labels && shipment.status === "label_ready" && (
        <div className="px-4 md:px-6 pb-8 -mt-4">
          <button
            type="button"
            className="text-caption text-muted-foreground hover:text-foreground underline"
            disabled={isBuyingLabel}
            onClick={() => callBuyLabel("refund")}
          >
            Cancel this label (before drop-off)
          </button>
        </div>
      )}

      {/* Add Tracking Modal */}
      <AddTrackingModal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        onSubmit={handleMarkAsShipped}
        orderNumber={displayOrderNumber}
        isLoading={isUpdating}
      />
    </PublisherLayout>
  );
};

export default PublisherOrderDetail;
