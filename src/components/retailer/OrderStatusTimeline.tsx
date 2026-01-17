import { Check, Circle, Package, CheckCircle2, Truck, Home, Copy } from "lucide-react";
import { toast } from "sonner";
import { ButtonSecondary } from "@/components/neesh";

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

interface StatusTimestamps {
  pending?: string;
  confirmed?: string;
  shipped?: string;
  delivered?: string;
}

interface OrderStatusTimelineProps {
  status: OrderStatus;
  timestamps: StatusTimestamps;
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  lastUpdated?: string;
}

const STATUS_ORDER: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered"];

const STATUS_CONFIG = {
  pending: { label: "Order Placed", icon: Package },
  confirmed: { label: "Confirmed", icon: CheckCircle2 },
  shipped: { label: "Shipped", icon: Truck },
  delivered: { label: "Delivered", icon: Home },
};

const CARRIER_URLS: Record<string, string> = {
  USPS: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  UPS: "https://www.ups.com/track?tracknum=",
  FedEx: "https://www.fedex.com/fedextrack/?trknbr=",
  DHL: "https://www.dhl.com/en/express/tracking.html?AWB=",
};

export const OrderStatusTimeline = ({
  status,
  timestamps,
  trackingNumber,
  carrier = "USPS",
  estimatedDelivery,
  lastUpdated,
}: OrderStatusTimelineProps) => {
  const currentIndex = STATUS_ORDER.indexOf(status);

  const copyTrackingNumber = () => {
    if (trackingNumber) {
      navigator.clipboard.writeText(trackingNumber);
      toast.success("Tracking number copied to clipboard");
    }
  };

  const openTracking = () => {
    const baseUrl = CARRIER_URLS[carrier] || CARRIER_URLS.USPS;
    window.open(`${baseUrl}${trackingNumber}`, "_blank");
  };

  const getStepState = (stepIndex: number) => {
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="card-neesh">
        <h3 className="font-display font-semibold text-lg mb-6">Order Status</h3>
        
        {/* Estimated Delivery */}
        {estimatedDelivery && (
          <div className="mb-6 p-3 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground">
              {status === "delivered" ? "Delivered on" : "Estimated delivery"}
            </p>
            <p className="font-medium">{estimatedDelivery}</p>
          </div>
        )}

        {/* Desktop: Horizontal Timeline */}
        <div className="hidden md:block">
          <div className="flex items-start justify-between relative">
            {/* Connecting Line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
            <div 
              className="absolute top-4 left-0 h-0.5 bg-accent transition-all duration-300"
              style={{ width: `${(currentIndex / (STATUS_ORDER.length - 1)) * 100}%` }}
            />

            {STATUS_ORDER.map((stepStatus, index) => {
              const state = getStepState(index);
              const config = STATUS_CONFIG[stepStatus];
              const Icon = config.icon;
              const timestamp = timestamps[stepStatus];

              return (
                <div key={stepStatus} className="flex flex-col items-center flex-1 relative z-10">
                  {/* Step Indicator */}
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center mb-3 transition-all
                      ${state === "completed" ? "bg-accent text-accent-foreground" : ""}
                      ${state === "current" ? "bg-accent text-accent-foreground ring-4 ring-accent/20" : ""}
                      ${state === "upcoming" ? "bg-secondary text-muted-foreground" : ""}
                    `}
                  >
                    {state === "completed" ? (
                      <Check className="w-4 h-4" />
                    ) : state === "current" ? (
                      <div className="relative">
                        <Icon className="w-4 h-4" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>

                  {/* Label */}
                  <p
                    className={`text-sm font-medium text-center ${
                      state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {config.label}
                  </p>

                  {/* Timestamp */}
                  {timestamp && (
                    <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: Vertical Timeline */}
        <div className="md:hidden space-y-0">
          {STATUS_ORDER.map((stepStatus, index) => {
            const state = getStepState(index);
            const config = STATUS_CONFIG[stepStatus];
            const Icon = config.icon;
            const timestamp = timestamps[stepStatus];
            const isLast = index === STATUS_ORDER.length - 1;

            return (
              <div key={stepStatus} className="flex gap-4">
                {/* Line + Indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${state === "completed" ? "bg-accent text-accent-foreground" : ""}
                      ${state === "current" ? "bg-accent text-accent-foreground ring-4 ring-accent/20" : ""}
                      ${state === "upcoming" ? "bg-secondary text-muted-foreground" : ""}
                    `}
                  >
                    {state === "completed" ? (
                      <Check className="w-4 h-4" />
                    ) : state === "current" ? (
                      <div className="relative">
                        <Icon className="w-4 h-4" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[24px] ${
                        state === "completed" || state === "current" ? "bg-accent" : "bg-border border-dashed"
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                  <p
                    className={`font-medium ${
                      state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {config.label}
                  </p>
                  {timestamp && (
                    <p className="text-sm text-muted-foreground">{timestamp}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tracking Information */}
      {(status === "shipped" || status === "delivered") && (
        <div className="card-neesh bg-secondary/50">
          <h3 className="font-display font-semibold text-lg mb-4">Tracking Information</h3>
          
          {trackingNumber ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Carrier</p>
                  <p className="font-medium">{carrier}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Tracking Number</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono font-medium">{trackingNumber}</p>
                  <button
                    onClick={copyTrackingNumber}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                    aria-label="Copy tracking number"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <ButtonSecondary onClick={openTracking} fullWidth className="md:w-auto">
                Track Package
              </ButtonSecondary>

              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {lastUpdated}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Tracking information will be available soon
            </p>
          )}
        </div>
      )}
    </div>
  );
};
