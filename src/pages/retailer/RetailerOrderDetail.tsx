import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, MessageCircle, User, RefreshCw, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RetailerLayout, useCart } from "@/components/retailer";
import { BackNavigation, StatusBadge, ButtonSecondary } from "@/components/neesh";
import { OrderStatusTimeline, OrderStatus } from "@/components/retailer/OrderStatusTimeline";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrderDetail {
  id: string;
  status: string;
  created_at: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tracking_number: string | null;
  shipping_address: string | null;
  stripe_payment_metadata: any;
  magazine: {
    id: string;
    title: string;
    cover_image_url: string | null;
  } | null;
}

export const RetailerOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addToCart } = useCart();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch order details
  useEffect(() => {
    if (!id) return;

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
            shipping_address,
            stripe_payment_metadata,
            magazines (
              id,
              title,
              cover_image_url
            )
          `)
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) {
          setError("Order not found");
          return;
        }

        setOrder(data as OrderDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch order');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const handleCancelOrder = () => {
    setShowCancelDialog(false);
    toast.success("Order cancelled successfully");
    navigate("/retailer/orders");
  };

  const handleReorder = () => {
    if (!order?.magazine) return;

    addToCart({
      magazineId: order.magazine.id,
      title: order.magazine.title,
      coverImage: order.magazine.cover_image_url || '',
      publisher: "Publisher", // We don't have publisher info in this query
      quantity: order.quantity,
      price: order.unit_price,
    });
    toast.success("Items added to cart");
    navigate("/retailer/cart");
  };

  const handleReportIssue = () => {
    toast.info("Report issue feature coming soon");
  };

  // Map database status to timeline status
  const getTimelineStatus = (status: string): OrderStatus => {
    const statusMap: Record<string, OrderStatus> = {
      'pending': 'pending',
      'paid': 'confirmed',
      'packed': 'confirmed',
      'shipped': 'shipped',
      'delivered': 'delivered',
    };
    return statusMap[status] || 'pending';
  };

  // Loading state
  if (isLoading) {
    return (
      <RetailerLayout>
        <BackNavigation
          title="Order Details"
          onBack={() => navigate("/retailer/orders")}
        />
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </RetailerLayout>
    );
  }

  // Error or not found state
  if (error || !order) {
    return (
      <RetailerLayout>
        <BackNavigation
          title="Order Details"
          onBack={() => navigate("/retailer/orders")}
        />
        <div className="px-4 md:px-6 py-12 text-center">
          <p className="text-destructive mb-4">{error || "Order not found"}</p>
          <ButtonSecondary onClick={() => navigate("/retailer/orders")}>
            Back to Orders
          </ButtonSecondary>
        </div>
      </RetailerLayout>
    );
  }

  // Prepare timeline timestamps (simplified for MVP)
  const timelineStatus = getTimelineStatus(order.status);
  const createdDate = format(new Date(order.created_at), 'MMM d, h:mm a');
  const timestamps = {
    pending: createdDate,
    confirmed: order.status !== 'pending' ? createdDate : undefined,
    shipped: order.status === 'shipped' || order.status === 'delivered' ? createdDate : undefined,
  };

  const displayOrderNumber = `#${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <RetailerLayout>
      <BackNavigation
        title={`Order ${displayOrderNumber}`}
        onBack={() => navigate("/retailer/orders")}
      />

      <div className="px-4 md:px-6 pb-24 md:pb-12 space-y-6">
        {/* Order Status Timeline */}
        <OrderStatusTimeline
          status={timelineStatus}
          timestamps={timestamps}
          trackingNumber={order.tracking_number || undefined}
          carrier={order.tracking_number ? "USPS" : undefined}
          estimatedDelivery="5-7 business days"
          lastUpdated={format(new Date(order.created_at), 'MMM d, h:mm a')}
        />

        {/* Order Items */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Items</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              {order.magazine?.cover_image_url && (
                <div className="w-16 h-22 rounded overflow-hidden bg-secondary flex-shrink-0">
                  <img
                    src={order.magazine.cover_image_url}
                    alt={order.magazine.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{order.magazine?.title || "Unknown Magazine"}</h4>
                <p className="text-sm text-muted-foreground">
                  Qty: {order.quantity} × {formatPrice(order.unit_price)}
                </p>
              </div>
              <p className="font-medium flex-shrink-0">
                {formatPrice(order.total_price)}
              </p>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="card-neesh">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">Shipping Address</h3>
          </div>
          <p className="text-muted-foreground">
            {order.shipping_address || "Address provided during checkout"}
          </p>
        </div>

        {/* Payment Summary */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Payment Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(order.total_price)}</span>
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{formatPrice(order.total_price)}</span>
            </div>
            {order.stripe_payment_metadata?.customer_email && (
              <p className="text-muted-foreground pt-2">
                Confirmation sent to {order.stripe_payment_metadata.customer_email}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons - Conditional based on status */}
        <div className="space-y-3">
          {order.status === "pending" && (
            <ButtonSecondary
              fullWidth
              destructive
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Order
            </ButtonSecondary>
          )}

          {order.status === "shipped" && (
            <ButtonSecondary fullWidth onClick={handleReportIssue}>
              Report Issue
            </ButtonSecondary>
          )}

          {order.status === "delivered" && (
            <>
              <ButtonSecondary
                fullWidth
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={handleReorder}
              >
                Reorder
              </ButtonSecondary>
              <ButtonSecondary fullWidth onClick={handleReportIssue}>
                Report Issue
              </ButtonSecondary>
            </>
          )}

          {/* View Invoice - Only for confirmed/shipped/delivered orders */}
          {['paid', 'packed', 'shipped', 'delivered'].includes(order.status) && (
            <ButtonSecondary
              fullWidth
              icon={<FileText className="w-4 h-4" />}
              onClick={() => navigate(`/retailer/orders/${id}/invoice`)}
            >
              View Invoice
            </ButtonSecondary>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ButtonSecondary
              fullWidth
              icon={<MessageCircle className="w-4 h-4" />}
            >
              Contact Publisher
            </ButtonSecondary>
            <ButtonSecondary fullWidth icon={<User className="w-4 h-4" />}>
              Publisher Profile
            </ButtonSecondary>
          </div>
        </div>
      </div>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This action cannot be
              undone and you will receive a full refund within 5-7 business days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RetailerLayout>
  );
};
