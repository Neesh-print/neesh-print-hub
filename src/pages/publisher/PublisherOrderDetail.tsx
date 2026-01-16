import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Package, Check } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, InfoCard, StatusBadge, ButtonSecondary } from "@/components/neesh";

const mockOrder = {
  id: "0001",
  date: "December 15, 2024",
  time: "2:30 PM",
  volume: 15,
  subtotal: 420.00,
  shipping: 30.00,
  total: 450.00,
  type: "Wholesale",
  fulfillmentStatus: "received" as const,
  paymentStatus: "payment-received" as const,
  wsp: 28.00,
  msrp: 45.00,
  revenue: 420.00,
  retailerMargin: "38%",
  billingAddress: {
    name: "Brooklyn Books",
    street: "123 Atlantic Ave",
    city: "Brooklyn, NY 11201",
    country: "United States"
  },
  shippingAddress: {
    name: "Brooklyn Books",
    street: "123 Atlantic Ave",
    city: "Brooklyn, NY 11201",
    country: "United States"
  },
  lineItem: {
    image: "/placeholder.svg",
    title: "Kinfolk Magazine",
    issue: "Issue 45",
    region: "North America",
    quantity: 15
  },
  tracking: {
    number: "1Z999AA10123456784",
    timeline: [
      { status: "Ordered", date: "Dec 12", completed: true },
      { status: "Order Ready", date: "Dec 13", completed: true },
      { status: "In Transit", date: "Dec 14", completed: true },
      { status: "Out for Delivery", date: "Dec 15", completed: false },
      { status: "Delivered", date: "—", completed: false },
    ],
    updates: [
      { location: "Brooklyn, NY", time: "Dec 15, 10:30 AM", status: "Out for delivery" },
      { location: "Queens Distribution Center", time: "Dec 15, 6:00 AM", status: "Arrived at local facility" },
      { location: "Newark, NJ", time: "Dec 14, 8:00 PM", status: "In transit" },
      { location: "Los Angeles, CA", time: "Dec 13, 2:00 PM", status: "Shipped" },
    ]
  }
};

export const PublisherOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <PublisherLayout>
      <BackNavigation
        title={`Order #${id || mockOrder.id}`}
        onBack={() => navigate("/publisher/orders")}
      />

      <div className="px-4 md:px-6 pb-8 space-y-6">
        {/* Top Info Cards Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <InfoCard title="Order Info">
            <div className="space-y-2 text-caption">
              <p><span className="text-muted-foreground">Order:</span> <span className="text-foreground">#{mockOrder.id}</span></p>
              <p><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{mockOrder.date}</span></p>
              <p><span className="text-muted-foreground">Time:</span> <span className="text-foreground">{mockOrder.time}</span></p>
              <p><span className="text-muted-foreground">Volume:</span> <span className="text-foreground">{mockOrder.volume} units</span></p>
            </div>
          </InfoCard>

          <InfoCard title="Pricing">
            <div className="space-y-2 text-caption">
              <p><span className="text-muted-foreground">Subtotal:</span> <span className="text-foreground">${mockOrder.subtotal.toFixed(2)}</span></p>
              <p><span className="text-muted-foreground">Shipping:</span> <span className="text-foreground">${mockOrder.shipping.toFixed(2)}</span></p>
              <p className="font-medium"><span className="text-muted-foreground">Total:</span> <span className="text-foreground">${mockOrder.total.toFixed(2)}</span></p>
            </div>
          </InfoCard>

          <InfoCard title="Status">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-caption text-muted-foreground">Type:</span>
                <StatusBadge status="pending" label={mockOrder.type} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-caption text-muted-foreground">Fulfillment:</span>
                <StatusBadge status={mockOrder.fulfillmentStatus} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-caption text-muted-foreground">Payment:</span>
                <StatusBadge status={mockOrder.paymentStatus} />
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Margins">
            <div className="space-y-2 text-caption">
              <p><span className="text-muted-foreground">WSP:</span> <span className="text-foreground">${mockOrder.wsp.toFixed(2)}</span></p>
              <p><span className="text-muted-foreground">MSRP:</span> <span className="text-foreground">${mockOrder.msrp.toFixed(2)}</span></p>
              <p><span className="text-muted-foreground">Revenue:</span> <span className="text-foreground">${mockOrder.revenue.toFixed(2)}</span></p>
              <p><span className="text-muted-foreground">Retailer Margin:</span> <span className="text-foreground">{mockOrder.retailerMargin}</span></p>
            </div>
          </InfoCard>
        </div>

        {/* Second Row */}
        <div className="grid md:grid-cols-4 gap-4">
          <InfoCard title="Billing Address">
            <div className="space-y-1 text-caption text-foreground">
              <p className="font-medium">{mockOrder.billingAddress.name}</p>
              <p className="text-muted-foreground">{mockOrder.billingAddress.street}</p>
              <p className="text-muted-foreground">{mockOrder.billingAddress.city}</p>
              <p className="text-muted-foreground">{mockOrder.billingAddress.country}</p>
            </div>
          </InfoCard>

          <InfoCard title="Shipping Address">
            <div className="space-y-1 text-caption text-foreground">
              <p className="font-medium">{mockOrder.shippingAddress.name}</p>
              <p className="text-muted-foreground">{mockOrder.shippingAddress.street}</p>
              <p className="text-muted-foreground">{mockOrder.shippingAddress.city}</p>
              <p className="text-muted-foreground">{mockOrder.shippingAddress.country}</p>
            </div>
          </InfoCard>

          <div className="space-y-3">
            <ButtonSecondary fullWidth>Edit Order</ButtonSecondary>
            <ButtonSecondary fullWidth destructive>Cancel Order</ButtonSecondary>
          </div>

          <div className="space-y-3">
            <ButtonSecondary fullWidth onClick={() => navigate("/publisher/messages")}>
              Contact Retailer
            </ButtonSecondary>
            <ButtonSecondary fullWidth>Retailer Profile</ButtonSecondary>
          </div>
        </div>

        {/* Line Item Card */}
        <div className="card-neesh">
          <div className="flex items-center gap-4">
            <img
              src={mockOrder.lineItem.image}
              alt={mockOrder.lineItem.title}
              className="w-20 h-28 object-cover rounded bg-secondary"
            />
            <div>
              <h4 className="font-display font-semibold text-body text-foreground">{mockOrder.lineItem.title}</h4>
              <p className="text-caption text-muted-foreground">{mockOrder.lineItem.issue}</p>
              <p className="text-caption text-muted-foreground">{mockOrder.lineItem.region}</p>
              <p className="text-caption text-foreground mt-1">Qty: {mockOrder.lineItem.quantity}</p>
            </div>
          </div>
        </div>

        {/* Track Shipment Section */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Track Shipment</h3>
          
          <p className="text-caption text-muted-foreground mb-4">
            Tracking Number: <span className="text-foreground font-medium">{mockOrder.tracking.number}</span>
          </p>

          {/* Timeline */}
          <div className="flex items-center justify-between mb-6">
            {mockOrder.tracking.timeline.map((step, index) => (
              <div key={step.status} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.completed ? "bg-chart-green" : "bg-secondary"
                }`}>
                  {step.completed && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
                <p className={`text-caption mt-2 text-center ${step.completed ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.status}
                </p>
                <p className="text-caption text-muted-foreground">{step.date}</p>
                {index < mockOrder.tracking.timeline.length - 1 && (
                  <div className={`absolute h-0.5 w-full top-4 left-1/2 ${
                    step.completed ? "bg-chart-green" : "bg-border"
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-caption text-muted-foreground">
              Order #{mockOrder.id} · {mockOrder.date}
            </p>
          </div>
        </div>

        {/* Latest Update Section */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Latest Update</h3>
          <div className="space-y-4">
            {mockOrder.tracking.updates.map((update, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                <div>
                  <p className="text-body text-foreground">{update.status}</p>
                  <p className="text-caption text-muted-foreground">{update.location} · {update.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Location Section */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Current Location</h3>
          <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-caption text-muted-foreground">Map placeholder</p>
              <p className="text-body text-foreground mt-1">Brooklyn, NY</p>
            </div>
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherOrderDetail;
