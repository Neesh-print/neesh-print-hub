import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Package, Truck, Printer, ShoppingBag, Loader2 } from "lucide-react";
import { RetailerLayout, useCart } from "@/components/retailer";
import { ButtonPrimary, ButtonSecondary, InfoCard } from "@/components/neesh";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Database } from "@/integrations/supabase/types";

type OrderRow = Database['public']['Tables']['orders']['Row'] & {
  magazines?: {
    title: string;
    cover_image_url: string | null;
    publishers?: {
      company_name: string | null;
    } | null;
  } | null;
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

// Fetch orders by Stripe session ID with polling
function useOrdersBySessionId(sessionId: string | undefined) {
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLL_COUNT = 15; // 15 retries * 2 seconds = 30 seconds max

  const query = useQuery({
    queryKey: ['orders', 'session', sessionId],
    queryFn: async (): Promise<OrderRow[]> => {
      if (!sessionId) throw new Error('No session ID provided');

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          magazines (
            title,
            cover_image_url,
            publishers (
              company_name
            )
          )
        `)
        .eq('stripe_session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && pollCount < MAX_POLL_COUNT,
    refetchInterval: (query) => {
      const data = query.state.data;
      // If we have data or reached max polls, stop polling
      if (data && data.length > 0) return false;
      if (pollCount >= MAX_POLL_COUNT) return false;
      
      // Otherwise, poll every 2 seconds
      return 2000;
    },
    refetchOnWindowFocus: false,
  });

  // Effect to handle polling count increment
  useEffect(() => {
    if (!query.data || query.data.length === 0) {
       // Increment poll count if no data yet
       // This simple logic might be too aggressive, ideally we increment on each fetch attempt
       // simplified for now as refetchInterval will handle the stopping condition
    }
  }, [query.data]);
  
  // Custom polling logic via effect to increment counter on refetch
  useEffect(() => {
     if (query.isFetchedAfterMount && (!query.data || query.data.length === 0)) {
         setPollCount(prev => prev + 1);
     }
  }, [query.isFetchedAfterMount, query.dataUpdatedAt, query.data]);

  return { ...query, hasTimedOut: pollCount >= MAX_POLL_COUNT };
}

export const RetailerOrderConfirmation = () => {
  const navigate = useNavigate();
  const { id: sessionId } = useParams(); // Renamed from 'id' to 'sessionId'
  const { clearCart } = useCart();
  const [isVisible, setIsVisible] = useState(false);
  const hasCleared = useRef(false);

  const { data: orders, isLoading, error, refetch, hasTimedOut } = useOrdersBySessionId(sessionId);

  // Animation trigger on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Clear cart immediately on confirmation page load
  // The user only reaches this page after Stripe redirects back from a successful checkout
  useEffect(() => {
    if (!hasCleared.current) {
      clearCart();
      hasCleared.current = true;
    }
  }, [clearCart]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const handlePrint = () => {
    window.print();
  };

  // Loading state - still waiting for webhook to create orders
  // Only show loading if we are still polling/loading and haven't timed out
  if ((isLoading || (!orders || orders.length === 0)) && !hasTimedOut) {
    return (
      <RetailerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Loader2 className="w-16 h-16 text-accent animate-spin mb-6" />
          <h2 className="font-display font-bold text-2xl mb-2">Confirming your order...</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Please wait while we process your payment. This usually takes just a few seconds.
          </p>
        </div>
      </RetailerLayout>
    );
  }

  // Timeout state - webhook took too long or error
  if (error || (orders && orders.length === 0)) {
    return (
      <RetailerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="font-display font-bold text-2xl mb-2">Payment Received!</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            We've received your payment, but your order details are still processing. 
            You'll receive a confirmation email shortly at the address you provided during checkout.
          </p>
          <ButtonPrimary onClick={() => navigate('/retailer/orders')}>
            View My Orders
          </ButtonPrimary>
        </div>
      </RetailerLayout>
    );
  }

  interface StripeMetadata {
    customer_email?: string;
    amount_total?: number;
  }

  // Success! We have orders - aggregate the data
  const firstOrder = orders[0];
  // @ts-ignore: metadata exists in DB but might be missing in generated types
  const metadata = (firstOrder as any)?.stripe_payment_metadata as unknown as StripeMetadata;
  const customerEmail = metadata?.customer_email || 'your email';
  const amountTotal = metadata?.amount_total;
  
  // Calculate totals from the order rows
  const subtotal = orders.reduce((sum, order) => sum + order.total_price, 0);
  const grandTotal = amountTotal ? amountTotal / 100 : subtotal; // Use Stripe's amount_total if available

  // Prepare line items
  const items = orders.map((order) => ({
    id: order.id,
    magazineTitle: order.magazines?.title || 'Unknown Magazine',
    publisher: order.magazines?.publishers?.company_name || 'Unknown Publisher',
    coverImage: order.magazines?.cover_image_url || '',
    quantity: order.quantity,
    unitPrice: order.unit_price,
    total: order.total_price,
  }));

  // Use first order ID as the display order number
  const displayOrderNumber = `#${firstOrder.id.slice(0, 8).toUpperCase()}`;

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
            <span className="text-foreground font-medium">{customerEmail}</span>
          </p>
        </div>

        {/* Print-only success header */}
        <div className="hidden print:block print-only text-center mb-6">
          <h1 className="font-display font-bold text-2xl">Order Confirmed</h1>
          <p className="text-muted-foreground text-sm">Confirmation sent to {customerEmail}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Left Column - Order Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Summary Card */}
            <div className="card-neesh">
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-display font-bold text-xl">{displayOrderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p className="font-medium">
                    {format(new Date(firstOrder.created_at || new Date()), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex gap-4">
                      <div className="w-12 h-16 rounded overflow-hidden bg-secondary flex-shrink-0">
                        {item.coverImage && (
                          <img
                            src={item.coverImage}
                            alt={item.magazineTitle}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {item.magazineTitle}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.publisher}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {formatPrice(item.unitPrice)}
                        </p>
                      </div>
                      <p className="font-medium text-foreground">
                        {formatPrice(item.total)}
                      </p>
                    </div>
                    {index < items.length - 1 && (
                      <div className="border-b border-border mt-4" />
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-6 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between font-display font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{formatPrice(grandTotal)}</span>
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
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">
                  Address provided during checkout
                </p>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm">
                  <span className="text-muted-foreground">Estimated delivery:</span>{" "}
                  <span className="font-medium">5-7 business days</span>
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
                onClick={() => navigate('/retailer/orders')}
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
