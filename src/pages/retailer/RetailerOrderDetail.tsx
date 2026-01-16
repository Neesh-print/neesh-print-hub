import { useNavigate, useParams } from "react-router-dom";
import { MapPin, MessageCircle, User, Package, Truck, CheckCircle } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, InfoCard, StatusBadge, ButtonSecondary } from "@/components/neesh";

const mockOrder = {
  id: "#0001",
  date: "January 15, 2026",
  time: "2:30 PM",
  quantity: 3,
  type: "Wholesale",
  subtotal: 26.43,
  shipping: 12.50,
  total: 38.93,
  wspTotal: 26.43,
  msrpTotal: 60.00,
  revenue: 60.00,
  margin: 33.57,
  paymentStatus: "paid" as const,
  fulfillmentStatus: "received" as const,
  trackingNumber: "1Z999AA10123456784",
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
  items: [
    { id: "1", title: "Weird Walk Issue 8", issue: "Issue 8", coverImage: "/placeholder.svg", quantity: 3, price: 8.81 },
  ],
  trackingEvents: [
    { status: "Ordered", date: "Jan 15, 2026", time: "2:30 PM", location: "Online", completed: true },
    { status: "Order Ready", date: "Jan 15, 2026", time: "4:00 PM", location: "London, UK", completed: true },
    { status: "In Transit", date: "Jan 16, 2026", time: "9:00 AM", location: "London Sorting Center", completed: true },
    { status: "Out for Delivery", date: "Jan 18, 2026", time: "8:00 AM", location: "Portland, OR", completed: false },
    { status: "Delivered", date: "", time: "", location: "", completed: false },
  ],
  latestUpdates: [
    { time: "Jan 18, 2026 8:00 AM", status: "Out for delivery", location: "Portland, OR" },
    { time: "Jan 17, 2026 6:00 PM", status: "Arrived at local facility", location: "Portland, OR" },
    { time: "Jan 16, 2026 9:00 AM", status: "In transit", location: "London Sorting Center" },
    { time: "Jan 15, 2026 4:00 PM", status: "Package picked up", location: "London, UK" },
  ],
};

export const RetailerOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const formatAddress = (addr: typeof mockOrder.billingAddress) => {
    return `${addr.name}\n${addr.street}${addr.apt ? `, ${addr.apt}` : ''}\n${addr.city}, ${addr.state} ${addr.postalCode}\n${addr.country}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <RetailerLayout>
      <BackNavigation
        title={`Order ${mockOrder.id}`}
        onBack={() => navigate("/retailer/orders")}
      />

      <div className="px-4 md:px-6 pb-12 space-y-6">
        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard title="Order Info">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order</span>
                <span className="font-medium">{mockOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{mockOrder.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span>{mockOrder.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume</span>
                <span>{mockOrder.quantity} units</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Pricing">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(mockOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatPrice(mockOrder.shipping)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatPrice(mockOrder.total)}</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Status">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <StatusBadge status="info" label={mockOrder.type} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fulfillment</span>
                <StatusBadge status="success" label="RECEIVED" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment</span>
                <StatusBadge status="success" label="PAID" />
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Margins">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">WSP</span>
                <span>{formatPrice(mockOrder.wspTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MSRP</span>
                <span>{formatPrice(mockOrder.msrpTotal)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-medium">
                <span>My Margin</span>
                <span>{formatPrice(mockOrder.margin)}</span>
              </div>
            </div>
          </InfoCard>
        </div>

        {/* Addresses and Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          <div className="space-y-2">
            <ButtonSecondary fullWidth>Edit Order</ButtonSecondary>
            <ButtonSecondary fullWidth destructive>Cancel Order</ButtonSecondary>
          </div>

          <div className="space-y-2">
            <ButtonSecondary fullWidth icon={<MessageCircle className="w-4 h-4" />}>
              Contact Publisher
            </ButtonSecondary>
            <ButtonSecondary fullWidth icon={<User className="w-4 h-4" />}>
              Publisher Profile
            </ButtonSecondary>
          </div>
        </div>

        {/* Line Items */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Order Items</h3>
          {mockOrder.items.map((item) => (
            <div key={item.id} className="flex gap-4">
              <div className="w-16 h-22 rounded overflow-hidden bg-secondary flex-shrink-0">
                <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.issue}</p>
                <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
              </div>
              <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        {/* Tracking Section */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Track Shipment</h3>
          
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">Tracking Number</p>
            <p className="font-mono font-medium">{mockOrder.trackingNumber}</p>
          </div>

          {/* Timeline */}
          <div className="flex items-center justify-between mb-8">
            {mockOrder.trackingEvents.map((event, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center mb-2
                  ${event.completed ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'}
                `}>
                  {index === 0 && <Package className="w-4 h-4" />}
                  {index === 1 && <CheckCircle className="w-4 h-4" />}
                  {index === 2 && <Truck className="w-4 h-4" />}
                  {index === 3 && <Truck className="w-4 h-4" />}
                  {index === 4 && <CheckCircle className="w-4 h-4" />}
                </div>
                <p className={`text-xs text-center ${event.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {event.status}
                </p>
                {event.date && (
                  <p className="text-xs text-muted-foreground">{event.date}</p>
                )}
                {index < mockOrder.trackingEvents.length - 1 && (
                  <div className={`
                    absolute h-0.5 w-full top-4
                    ${event.completed ? 'bg-accent' : 'bg-secondary'}
                  `} />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Order: {mockOrder.id}</span>
            <span>Date: {mockOrder.date}</span>
          </div>
        </div>

        {/* Latest Updates */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Latest Update</h3>
          <div className="space-y-3">
            {mockOrder.latestUpdates.map((update, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{update.status}</p>
                  <p className="text-xs text-muted-foreground">{update.location}</p>
                </div>
                <p className="text-xs text-muted-foreground">{update.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-lg mb-4">Current Location</h3>
          <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2" />
              <p>Map placeholder</p>
              <p className="text-sm">Portland, OR</p>
            </div>
          </div>
        </div>
      </div>
    </RetailerLayout>
  );
};
