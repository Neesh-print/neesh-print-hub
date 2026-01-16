import { useNavigate, useParams } from "react-router-dom";
import { Pencil, X, RefreshCw, ChevronRight } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, InfoCard, ButtonSecondary, ButtonPrimary } from "@/components/neesh";

const mockOrder = {
  id: "ORD-001",
  date: "January 15, 2026",
  items: [
    { id: "1", title: "Weird Walk Issue 8", issue: "Issue 8", coverImage: "/placeholder.svg", quantity: 3, price: 8.81 },
    { id: "2", title: "Apartamento #32", issue: "#32", coverImage: "/placeholder.svg", quantity: 2, price: 18.00 },
  ],
  billingAddress: {
    name: "Jane Smith",
    street: "456 Market Street",
    apt: "Suite 200",
    city: "Portland",
    state: "OR",
    postalCode: "97201",
    country: "United States",
  },
  shippingAddress: {
    name: "Jane Smith",
    street: "456 Market Street",
    apt: "Suite 200",
    city: "Portland",
    state: "OR",
    postalCode: "97201",
    country: "United States",
  },
  subtotal: 62.43,
  shipping: 12.50,
  total: 74.93,
};

export const RetailerOrderConfirmation = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatAddress = (addr: typeof mockOrder.billingAddress) => {
    return `${addr.name}\n${addr.street}${addr.apt ? `, ${addr.apt}` : ''}\n${addr.city}, ${addr.state} ${addr.postalCode}\n${addr.country}`;
  };

  return (
    <RetailerLayout>
      <BackNavigation
        title="Order Confirmation"
        onBack={() => navigate("/retailer/orders")}
      />

      <div className="px-4 md:px-6 pb-12">
        {/* Success Message */}
        <div className="text-center py-8 mb-8">
          <h1 className="font-display font-bold text-3xl text-accent mb-2">
            Thank You for your Purchase
          </h1>
          <p className="text-accent/80">
            An email has been sent to your inbox!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Order Items */}
          <div className="lg:col-span-2">
            <div className="card-neesh">
              <h2 className="font-display font-semibold text-lg text-foreground mb-4">
                Order Items
              </h2>
              <div className="space-y-4">
                {mockOrder.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex gap-4">
                      <div className="w-16 h-22 rounded overflow-hidden bg-secondary flex-shrink-0">
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display font-medium text-foreground">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.issue}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-display font-semibold text-foreground">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                    {index < mockOrder.items.length - 1 && (
                      <div className="border-b border-border mt-4" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Order Details */}
          <div className="lg:col-span-1 space-y-4">
            <InfoCard title="Order Details">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Number</span>
                  <span className="font-medium">{mockOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{mockOrder.date}</span>
                </div>
              </div>
            </InfoCard>

            <InfoCard title="Billing Address">
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {formatAddress(mockOrder.billingAddress)}
              </p>
            </InfoCard>

            <InfoCard title="Shipping Address">
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {formatAddress(mockOrder.shippingAddress)}
              </p>
            </InfoCard>

            <div className="card-neesh">
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(mockOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>{formatPrice(mockOrder.shipping)}</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between font-display font-bold text-lg">
                  <span>Total</span>
                  <span>{formatPrice(mockOrder.total)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <ButtonSecondary fullWidth icon={<Pencil className="w-4 h-4" />}>
                Edit Order
              </ButtonSecondary>
              <ButtonSecondary fullWidth icon={<X className="w-4 h-4" />} destructive>
                Cancel Order
              </ButtonSecondary>
              <ButtonSecondary fullWidth icon={<RefreshCw className="w-4 h-4" />}>
                Re-Order
              </ButtonSecondary>
            </div>

            <ButtonPrimary 
              fullWidth 
              onClick={() => navigate("/retailer/orders")}
              className="bg-muted hover:bg-muted/80 text-foreground"
            >
              View your orders
            </ButtonPrimary>

            <button
              onClick={() => navigate("/retailer")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              Still searching? Back to Catalog <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </RetailerLayout>
  );
};
