import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Package, CreditCard, Truck, MapPin, MessageSquare, RefreshCw } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, StatusBadge, ButtonPrimary, ButtonSecondary, FormTextarea } from "@/components/neesh";
import { FormSelect } from "@/components/neesh/FormSelect";

// Mock order data
const mockOrder = {
  id: "0049",
  retailer: "Powell's Books",
  retailerEmail: "magazines@powells.com",
  publisher: "Kinfolk Magazine",
  publisherEmail: "hello@kinfolk.com",
  orderDate: "January 16, 2026",
  paymentStatus: "payment-received" as const,
  fulfillmentStatus: "pending" as const,
  subtotal: 432.00,
  shipping: 18.00,
  neeshCommission: 45.00,
  total: 450.00,
  publisherPayout: 405.00,
  billingAddress: {
    name: "Powell's Books",
    street: "1005 W Burnside St",
    city: "Portland",
    state: "OR",
    zip: "97209",
    country: "USA",
  },
  shippingAddress: {
    name: "Powell's Books - Receiving",
    street: "1005 W Burnside St",
    city: "Portland",
    state: "OR",
    zip: "97209",
    country: "USA",
  },
  items: [
    { id: "1", title: "Kinfolk Issue 50", coverImage: "/placeholder.svg", quantity: 12, unitPrice: 18.00, total: 216.00 },
    { id: "2", title: "Kinfolk Issue 49", coverImage: "/placeholder.svg", quantity: 12, unitPrice: 18.00, total: 216.00 },
  ],
  tracking: {
    number: "1Z999AA10123456784",
    carrier: "UPS",
    estimatedDelivery: "January 20, 2026",
  },
  timeline: [
    { date: "Jan 16, 2026 9:42 AM", event: "Order placed", status: "completed" },
    { date: "Jan 16, 2026 9:45 AM", event: "Payment received", status: "completed" },
    { date: "Jan 16, 2026 2:30 PM", event: "Order confirmed by publisher", status: "completed" },
    { date: "Pending", event: "Shipped", status: "pending" },
    { date: "Pending", event: "Delivered", status: "pending" },
  ],
  adminNotes: "",
};

const fulfillmentOptions = [
  { value: "pending", label: "Pending" },
  { value: "received", label: "Shipped/Fulfilled" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "returned", label: "Returned" },
];

const paymentOptions = [
  { value: "payment-pending", label: "Payment Pending" },
  { value: "payment-received", label: "Payment Received" },
  { value: "payment-sent", label: "Payout Sent" },
];

export const AdminOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState(mockOrder);
  const [fulfillmentStatus, setFulfillmentStatus] = useState(order.fulfillmentStatus);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
  const [adminNotes, setAdminNotes] = useState(order.adminNotes);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const formatAddress = (address: typeof mockOrder.billingAddress) => {
    return `${address.name}\n${address.street}\n${address.city}, ${address.state} ${address.zip}\n${address.country}`;
  };

  const handleRefund = () => {
    console.log("Processing refund for order:", id);
    setShowRefundModal(false);
  };

  return (
    <AdminLayout>
      <BackNavigation title={`Order #${order.id}`} onBack={() => navigate("/admin/orders")} />

      <div className="px-4 md:px-6 pb-8">
        {/* Info Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <InfoCard title="Order Info">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Order #</span>
                <span className="text-body font-medium">#{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Date</span>
                <span className="text-body">{order.orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Retailer</span>
                <span className="text-body">{order.retailer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Publisher</span>
                <span className="text-body">{order.publisher}</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Pricing">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Subtotal</span>
                <span className="text-body">${order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Shipping</span>
                <span className="text-body">${order.shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-accent">
                <span className="text-caption">Neesh Commission (10%)</span>
                <span className="text-body font-medium">${order.neeshCommission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-body font-medium">Total</span>
                <span className="text-body font-bold">${order.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Publisher Payout</span>
                <span className="text-body">${order.publisherPayout.toFixed(2)}</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Payment Status">
            <div className="space-y-3">
              <StatusBadge status={order.paymentStatus} />
              <p className="text-caption text-muted-foreground">
                Payment processed via Stripe
              </p>
            </div>
          </InfoCard>

          <InfoCard title="Fulfillment Status">
            <div className="space-y-3">
              <StatusBadge status={order.fulfillmentStatus} />
              {order.tracking.number && (
                <div className="text-caption">
                  <p className="text-muted-foreground">Tracking:</p>
                  <p className="text-foreground font-mono">{order.tracking.number}</p>
                  <p className="text-muted-foreground">{order.tracking.carrier}</p>
                </div>
              )}
            </div>
          </InfoCard>
        </div>

        {/* Addresses */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <InfoCard title="Billing Address">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <pre className="text-body text-foreground whitespace-pre-line font-sans">
                {formatAddress(order.billingAddress)}
              </pre>
            </div>
          </InfoCard>

          <InfoCard title="Shipping Address">
            <div className="flex items-start gap-2">
              <Truck className="w-4 h-4 text-muted-foreground mt-0.5" />
              <pre className="text-body text-foreground whitespace-pre-line font-sans">
                {formatAddress(order.shippingAddress)}
              </pre>
            </div>
          </InfoCard>
        </div>

        {/* Line Items */}
        <div className="card-neesh mb-6">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Order Items</h3>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
                <img 
                  src={item.coverImage} 
                  alt={item.title}
                  className="w-12 h-16 object-cover rounded bg-background"
                />
                <div className="flex-1">
                  <p className="font-medium text-body text-foreground">{item.title}</p>
                  <p className="text-caption text-muted-foreground">
                    Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium text-body text-foreground">${item.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="card-neesh mb-6">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Order Timeline</h3>
          <div className="space-y-4">
            {order.timeline.map((event, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className={`w-3 h-3 rounded-full mt-1.5 ${
                  event.status === 'completed' ? 'bg-status-success' : 'bg-border'
                }`} />
                <div>
                  <p className="text-body text-foreground">{event.event}</p>
                  <p className="text-caption text-muted-foreground">{event.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Tools */}
        <div className="card-neesh mb-6">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Admin Tools</h3>
          
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div>
              <FormSelect
                label="Update Fulfillment Status"
                value={fulfillmentStatus}
                onChange={(value) => setFulfillmentStatus(value as typeof fulfillmentStatus)}
                options={fulfillmentOptions}
              />
              <ButtonSecondary className="mt-2" onClick={() => console.log("Saving fulfillment:", fulfillmentStatus)}>
                Save Status
              </ButtonSecondary>
            </div>
            <div>
              <FormSelect
                label="Update Payment Status"
                value={paymentStatus}
                onChange={(value) => setPaymentStatus(value as typeof paymentStatus)}
                options={paymentOptions}
              />
              <ButtonSecondary className="mt-2" onClick={() => console.log("Saving payment:", paymentStatus)}>
                Save Status
              </ButtonSecondary>
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
            <ButtonSecondary className="mt-2" onClick={() => console.log("Saving notes:", adminNotes)}>
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
        message={`Are you sure you want to issue a full refund of $${order.total.toFixed(2)} for this order? This action cannot be undone.`}
        confirmLabel="Issue Refund"
        confirmVariant="destructive"
      />
    </AdminLayout>
  );
};

export default AdminOrderDetail;
