import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, MessageCircle, User, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, InfoCard, StatusBadge, ButtonSecondary } from "@/components/neesh";
import { OrderStatusTimeline, OrderStatus } from "@/components/retailer/OrderStatusTimeline";
import { useCart } from "@/components/retailer/CartContext";
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

// Mock data demonstrating "shipped" state
const mockOrder = {
  id: "#0001",
  status: "shipped" as OrderStatus,
  timestamps: {
    pending: "Jan 15, 2:30 PM",
    confirmed: "Jan 15, 4:45 PM",
    shipped: "Jan 16, 9:00 AM",
  },
  estimatedDelivery: "Jan 18-20",
  trackingNumber: "1Z999AA10123456784",
  carrier: "USPS",
  lastUpdated: "Jan 16, 2:30 PM",
  subtotal: 26.43,
  shipping: 12.50,
  tax: 2.35,
  total: 41.28,
  paymentMethod: "Visa ending in 4242",
  shippingAddress: {
    name: "Brooklyn Books",
    street: "142 Smith Street",
    apt: "",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    country: "United States",
  },
  items: [
    { 
      id: "1", 
      magazineId: "mag-1",
      title: "Weird Walk Issue 8", 
      issue: "Issue 8", 
      coverImage: "/placeholder.svg", 
      quantity: 3, 
      price: 8.81,
      publisher: "Weird Walk Press"
    },
  ],
};

export const RetailerOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addToCart } = useCart();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const formatAddress = (addr: typeof mockOrder.shippingAddress) => {
    const lines = [
      addr.name,
      addr.street,
      addr.apt,
      `${addr.city}, ${addr.state} ${addr.postalCode}`,
      addr.country,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const copyAddress = () => {
    const addressText = formatAddress(mockOrder.shippingAddress);
    navigator.clipboard.writeText(addressText.replace(/\n/g, ", "));
    toast.success("Address copied to clipboard");
  };

  const handleCancelOrder = () => {
    setShowCancelDialog(false);
    toast.success("Order cancelled successfully");
    navigate("/retailer/orders");
  };

  const handleReorder = () => {
    mockOrder.items.forEach((item) => {
      addToCart({
        magazineId: item.magazineId,
        title: item.title,
        coverImage: item.coverImage,
        publisher: item.publisher,
        issue: item.issue,
        quantity: item.quantity,
        price: item.price,
      });
    });
    toast.success("Items added to cart");
    navigate("/retailer/cart");
  };

  const handleReportIssue = () => {
    toast.info("Report issue feature coming soon");
  };

  return (
    <RetailerLayout>
      <BackNavigation
        title={`Order ${mockOrder.id}`}
        onBack={() => navigate("/retailer/orders")}
      />

      <div className="px-4 md:px-6 pb-24 md:pb-12 space-y-6">
        {/* Order Status Timeline */}
        <OrderStatusTimeline
          status={mockOrder.status}
          timestamps={mockOrder.timestamps}
          trackingNumber={mockOrder.trackingNumber}
          carrier={mockOrder.carrier}
          estimatedDelivery={mockOrder.estimatedDelivery}
          lastUpdated={mockOrder.lastUpdated}
        />

        {/* Order Items */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Items</h3>
          <div className="space-y-4">
            {mockOrder.items.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="w-16 h-22 rounded overflow-hidden bg-secondary flex-shrink-0">
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.issue}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className="font-medium flex-shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="card-neesh">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">Shipping Address</h3>
            <button
              onClick={copyAddress}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              aria-label="Copy address"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-muted-foreground whitespace-pre-line">
            {formatAddress(mockOrder.shippingAddress)}
          </p>
        </div>

        {/* Payment Summary */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Payment Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(mockOrder.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatPrice(mockOrder.shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(mockOrder.tax)}</span>
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{formatPrice(mockOrder.total)}</span>
            </div>
            <p className="text-muted-foreground pt-2">
              Paid with {mockOrder.paymentMethod}
            </p>
          </div>
        </div>

        {/* Action Buttons - Conditional based on status */}
        <div className="space-y-3">
          {mockOrder.status === "pending" && (
            <ButtonSecondary
              fullWidth
              destructive
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Order
            </ButtonSecondary>
          )}

          {mockOrder.status === "shipped" && (
            <ButtonSecondary fullWidth onClick={handleReportIssue}>
              Report Issue
            </ButtonSecondary>
          )}

          {mockOrder.status === "delivered" && (
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
