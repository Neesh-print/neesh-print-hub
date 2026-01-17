import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Package, Truck, Printer, ArrowLeft, ShoppingBag } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { ButtonPrimary, ButtonSecondary, InfoCard } from "@/components/neesh";
import { format } from "date-fns";

// Mock order data - will be replaced with real data fetch
const MOCK_ORDER_CONFIRMATION = {
  id: 'ORD-789',
  email: 'orders@commonplacebooks.com',
  created_at: '2026-01-17T15:30:00Z',
  items: [
    {
      id: 'item-1',
      magazine: {
        title: 'Wax Poetics Issue 75',
        publisher: 'Wax Poetics',
        cover_image: 'https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1757968055495.png',
      },
      quantity: 3,
      unit_price: 11.99,
      total: 35.97,
    },
    {
      id: 'item-2',
      magazine: {
        title: 'Mushroom People Volume 2',
        publisher: 'Broccoli Publishing',
        cover_image: 'https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_f42a6f9b-ddb3-4e6e-a873-3a21a6fd5897.png',
      },
      quantity: 2,
      unit_price: 16.79,
      total: 33.58,
    },
  ],
  subtotal: 69.55,
  shipping: 8.50,
  tax: 0,
  total: 78.05,
  shipping_address: {
    business_name: 'Commonplace Books',
    attention: 'Michael Torres',
    street: '1234 Main Street',
    city: 'Denver',
    state: 'CO',
    postal_code: '80202',
    country: 'United States',
  },
  estimated_delivery: '5-7 business days',
};

interface TimelineStepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'completed' | 'pending';
  isLast?: boolean;
}

const TimelineStep = ({ icon, title, description, status, isLast }: TimelineStepProps) => (
  <div className="flex flex-col items-center text-center flex-1">
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
        status === 'completed'
          ? 'bg-green-100 text-green-600'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {icon}
    </div>
    <h4 className={`font-medium text-sm ${status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}`}>
      {title}
    </h4>
    <p className="text-xs text-muted-foreground mt-1">{description}</p>
  </div>
);

const TimelineConnector = ({ completed }: { completed: boolean }) => (
  <div className={`hidden md:block flex-1 h-0.5 mt-6 mx-2 ${completed ? 'bg-green-300' : 'bg-border'}`} />
);

// Mobile vertical timeline
const VerticalTimelineStep = ({ icon, title, description, status, isLast }: TimelineStepProps) => (
  <div className="flex gap-4">
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          status === 'completed'
            ? 'bg-green-100 text-green-600'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {icon}
      </div>
      {!isLast && (
        <div className={`w-0.5 h-12 ${status === 'completed' ? 'bg-green-300' : 'bg-border'}`} />
      )}
    </div>
    <div className="pt-2">
      <h4 className={`font-medium text-sm ${status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </h4>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  </div>
);

export const RetailerOrderConfirmation = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isVisible, setIsVisible] = useState(false);

  // Animation trigger on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // TODO: Fetch real order data based on id
  const order = MOCK_ORDER_CONFIRMATION;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatAddress = () => {
    const addr = order.shipping_address;
    return (
      <>
        <p className="font-medium">{addr.business_name}</p>
        {addr.attention && <p className="text-muted-foreground">Attn: {addr.attention}</p>}
        <p className="text-muted-foreground">{addr.street}</p>
        <p className="text-muted-foreground">
          {addr.city}, {addr.state} {addr.postal_code}
        </p>
        <p className="text-muted-foreground">{addr.country}</p>
      </>
    );
  };

  return (
    <RetailerLayout>
      {/* Print-only header */}
      <div className="hidden print:block print-only mb-8">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <h1 className="font-display text-2xl font-bold">NEESH</h1>
          <p className="text-sm text-muted-foreground">Order Receipt</p>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-12">
        {/* Success Header - Animated */}
        <div
          className={`text-center py-8 mb-8 no-print transition-all duration-500 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">
            Order Confirmed!
          </h1>
          <p className="text-muted-foreground">
            Thanks for your order. We've sent a confirmation to{" "}
            <span className="text-foreground font-medium">{order.email}</span>
          </p>
        </div>

        {/* Print-only success header */}
        <div className="hidden print:block print-only text-center mb-6">
          <h1 className="font-display font-bold text-2xl">Order Confirmed</h1>
          <p className="text-muted-foreground text-sm">Confirmation sent to {order.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Left Column - Order Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Summary Card */}
            <div className="card-neesh">
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-display font-bold text-xl">#{order.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p className="font-medium">
                    {format(new Date(order.created_at), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex gap-4">
                      <div className="w-12 h-16 rounded overflow-hidden bg-secondary flex-shrink-0">
                        <img
                          src={item.magazine.cover_image}
                          alt={item.magazine.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {item.magazine.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.magazine.publisher}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {formatPrice(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-medium text-foreground">
                        {formatPrice(item.total)}
                      </p>
                    </div>
                    {index < order.items.length - 1 && (
                      <div className="border-b border-border mt-4" />
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-6 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatPrice(order.shipping)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatPrice(order.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-display font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            {/* What Happens Next - Desktop Horizontal Timeline */}
            <div className="card-neesh no-print hidden md:block">
              <h2 className="font-display font-semibold text-lg mb-6">What happens next</h2>
              <div className="flex items-start">
                <TimelineStep
                  icon={<CheckCircle className="w-5 h-5" />}
                  title="Order Received"
                  description="Publisher has been notified"
                  status="completed"
                />
                <TimelineConnector completed={false} />
                <TimelineStep
                  icon={<Package className="w-5 h-5" />}
                  title="Publisher Ships"
                  description="Usually within 3-5 business days"
                  status="pending"
                />
                <TimelineConnector completed={false} />
                <TimelineStep
                  icon={<Truck className="w-5 h-5" />}
                  title="Delivery"
                  description="Track your order in your dashboard"
                  status="pending"
                  isLast
                />
              </div>
            </div>

            {/* What Happens Next - Mobile Vertical Timeline */}
            <div className="card-neesh no-print md:hidden">
              <h2 className="font-display font-semibold text-lg mb-4">What happens next</h2>
              <div className="space-y-0">
                <VerticalTimelineStep
                  icon={<CheckCircle className="w-4 h-4" />}
                  title="Order Received"
                  description="Publisher has been notified"
                  status="completed"
                />
                <VerticalTimelineStep
                  icon={<Package className="w-4 h-4" />}
                  title="Publisher Ships"
                  description="Usually within 3-5 business days"
                  status="pending"
                />
                <VerticalTimelineStep
                  icon={<Truck className="w-4 h-4" />}
                  title="Delivery"
                  description="Track your order in your dashboard"
                  status="pending"
                  isLast
                />
              </div>
            </div>
          </div>

          {/* Right Column - Shipping & Actions */}
          <div className="lg:col-span-1 space-y-4">
            {/* Shipping Details */}
            <InfoCard title="Shipping To">
              <div className="text-sm space-y-1">{formatAddress()}</div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm">
                  <span className="text-muted-foreground">Estimated delivery:</span>{" "}
                  <span className="font-medium">{order.estimated_delivery}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  You'll receive tracking information once your order ships
                </p>
              </div>
            </InfoCard>

            {/* Actions */}
            <div className="space-y-3 no-print">
              <ButtonPrimary
                fullWidth
                onClick={() => navigate(`/retailer/orders/${id}`)}
              >
                View Order Details
              </ButtonPrimary>
              <ButtonSecondary
                fullWidth
                icon={<ShoppingBag className="w-4 h-4" />}
                onClick={() => navigate("/retailer")}
              >
                Continue Shopping
              </ButtonSecondary>
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>

        {/* Print-only footer */}
        <div className="hidden print:block print-only mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">Thank you for supporting independent print!</p>
          <p>Questions? Contact hi@neesh.art</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            font-size: 12pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .card-neesh {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
          }
        }
      `}</style>
    </RetailerLayout>
  );
};
