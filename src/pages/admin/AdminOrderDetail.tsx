import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Package, MapPin, MessageSquare, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, StatusBadge, ButtonSecondary, FormTextarea } from "@/components/neesh";
import { FormSelect } from "@/components/neesh/FormSelect";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateOrderStatus } from "@/hooks/useUpdateOrderStatus";
import { format } from "date-fns";

interface OrderDetail {
  id: string;
  status: string;
  total_price: number;
  unit_price: number;
  quantity: number;
  created_at: string;
  tracking_number: string | null;
  shipping_address: string | null;
  notes: string | null;
  retailer: {
    id: string;
    shop_name: string | null;
    user_id: string;
  } | null;
  magazine: {
    id: string;
    title: string;
    cover_image_url: string | null;
    price: number;
    publisher: {
      id: string;
      company_name: string | null;
    } | null;
  } | null;
}

const fulfillmentOptions = [
  { value: "pending", label: "Pending" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];

const paymentOptions = [
  { value: "pending", label: "Payment Pending" },
  { value: "paid", label: "Payment Received" },
];

export const AdminOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const { updateStatus, isUpdating } = useUpdateOrderStatus();

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_price,
          unit_price,
          quantity,
          created_at,
          tracking_number,
          shipping_address,
          notes,
          retailers (
            id,
            shop_name,
            user_id
          ),
          magazines (
            id,
            title,
            cover_image_url,
            price,
            publishers (
              id,
              company_name
            )
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Order not found');

      const orderData: OrderDetail = {
        id: data.id,
        status: data.status,
        total_price: Number(data.total_price) || 0,
        unit_price: Number(data.unit_price) || 0,
        quantity: data.quantity,
        created_at: data.created_at || '',
        tracking_number: data.tracking_number,
        shipping_address: data.shipping_address,
        notes: data.notes,
        retailer: data.retailers ? {
          id: (data.retailers as any).id,
          shop_name: (data.retailers as any).shop_name,
          user_id: (data.retailers as any).user_id,
        } : null,
        magazine: data.magazines ? {
          id: (data.magazines as any).id,
          title: (data.magazines as any).title,
          cover_image_url: (data.magazines as any).cover_image_url,
          price: (data.magazines as any).price,
          publisher: (data.magazines as any).publishers ? {
            id: (data.magazines as any).publishers.id,
            company_name: (data.magazines as any).publishers.company_name,
          } : null,
        } : null,
      };

      setOrder(orderData);
      setFulfillmentStatus(orderData.status);
      setPaymentStatus(orderData.status === 'pending' ? 'pending' : 'paid');
      setAdminNotes(orderData.notes || '');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleSaveStatus = async () => {
    if (!order) return;
    const success = await updateStatus(order.id, fulfillmentStatus);
    if (success) {
      fetchOrder();
    }
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ notes: adminNotes, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  const handleRefund = () => {
    // In a real app, this would call a Stripe refund endpoint
    console.log("Processing refund for order:", id);
    setShowRefundModal(false);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <BackNavigation title="Order Details" onBack={() => navigate("/admin/orders")} />
        <div className="px-4 md:px-6 pb-8 flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-body text-muted-foreground">Loading order...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !order) {
    return (
      <AdminLayout>
        <BackNavigation title="Order Details" onBack={() => navigate("/admin/orders")} />
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-status-error-text mb-3" />
            <h3 className="font-display font-semibold text-heading text-foreground mb-1">Order not found</h3>
            <p className="text-body text-muted-foreground mb-4">{error || 'This order could not be loaded.'}</p>
            <ButtonSecondary onClick={() => navigate("/admin/orders")}>Back to Orders</ButtonSecondary>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const orderDate = order.created_at ? format(new Date(order.created_at), "MMMM d, yyyy") : "Unknown";
  const orderNumber = order.id.slice(0, 8).toUpperCase();

  return (
    <AdminLayout>
      <BackNavigation title={`Order #${orderNumber}`} onBack={() => navigate("/admin/orders")} />

      <div className="px-4 md:px-6 pb-8">
        {/* Info Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <InfoCard title="Order Info">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Order #</span>
                <span className="text-body font-medium">#{orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Date</span>
                <span className="text-body">{orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Retailer</span>
                <span className="text-body">{order.retailer?.shop_name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Publisher</span>
                <span className="text-body">{order.magazine?.publisher?.company_name || 'Unknown'}</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Pricing">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Unit Price</span>
                <span className="text-body">${order.unit_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Quantity</span>
                <span className="text-body">{order.quantity}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-body font-medium">Total</span>
                <span className="text-body font-bold">${order.total_price.toFixed(2)}</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Payment Status">
            <div className="space-y-3">
              <StatusBadge status={order.status === 'pending' ? 'payment-pending' : 'payment-received'} />
            </div>
          </InfoCard>

          <InfoCard title="Fulfillment Status">
            <div className="space-y-3">
              <StatusBadge status={order.status === 'shipped' || order.status === 'delivered' ? 'received' : order.status === 'pending' ? 'pending' : 'unfulfilled'} />
              {order.tracking_number && (
                <div className="text-caption">
                  <p className="text-muted-foreground">Tracking:</p>
                  <p className="text-foreground font-mono">{order.tracking_number}</p>
                </div>
              )}
            </div>
          </InfoCard>
        </div>

        {/* Shipping Address */}
        {order.shipping_address && (
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <InfoCard title="Shipping Address">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <pre className="text-body text-foreground whitespace-pre-line font-sans">
                  {order.shipping_address}
                </pre>
              </div>
            </InfoCard>
          </div>
        )}

        {/* Line Items */}
        {order.magazine && (
          <div className="card-neesh mb-6">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Order Items</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
                <img
                  src={order.magazine.cover_image_url || "/placeholder.svg"}
                  alt={order.magazine.title}
                  className="w-12 h-16 object-cover rounded bg-background"
                />
                <div className="flex-1">
                  <p className="font-medium text-body text-foreground">{order.magazine.title}</p>
                  <p className="text-caption text-muted-foreground">
                    Qty: {order.quantity} x ${order.unit_price.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium text-body text-foreground">${order.total_price.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Tools */}
        <div className="card-neesh mb-6">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Admin Tools</h3>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div>
              <FormSelect
                label="Update Fulfillment Status"
                value={fulfillmentStatus}
                onChange={(value) => setFulfillmentStatus(value)}
                options={fulfillmentOptions}
              />
              <ButtonSecondary
                className="mt-2"
                onClick={handleSaveStatus}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Status"}
              </ButtonSecondary>
            </div>
            <div>
              <FormSelect
                label="Payment Status"
                value={paymentStatus}
                onChange={(value) => setPaymentStatus(value)}
                options={paymentOptions}
              />
            </div>
          </div>

          <div className="flex gap-3 flex-wrap mb-6">
            <ButtonSecondary onClick={() => setShowRefundModal(true)} className="gap-2 text-status-error-text">
              <RefreshCw className="w-4 h-4" />
              Issue Refund
            </ButtonSecondary>
            <ButtonSecondary className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Contact Retailer
            </ButtonSecondary>
            <ButtonSecondary className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Contact Publisher
            </ButtonSecondary>
          </div>

          <div>
            <FormTextarea
              label="Admin Notes"
              placeholder="Add internal notes about this order..."
              value={adminNotes}
              onChange={setAdminNotes}
            />
            <ButtonSecondary className="mt-2" onClick={handleSaveNotes}>
              Save Notes
            </ButtonSecondary>
          </div>
        </div>
      </div>

      {/* Refund Modal */}
      <ConfirmationModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onConfirm={handleRefund}
        title="Issue Refund"
        message={`Are you sure you want to issue a full refund of $${order.total_price.toFixed(2)} for this order? This action cannot be undone.`}
        confirmLabel="Issue Refund"
        confirmVariant="destructive"
      />
    </AdminLayout>
  );
};

export default AdminOrderDetail;
