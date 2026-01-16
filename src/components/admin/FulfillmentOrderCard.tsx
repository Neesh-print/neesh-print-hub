import { Package, Printer, Truck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ButtonPrimary, ButtonSecondary } from "@/components/neesh";

export interface FulfillmentOrderItem {
  title: string;
  quantity: number;
}

export interface FulfillmentOrder {
  id: string;
  orderNumber: string;
  retailerName: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  items: FulfillmentOrderItem[];
  status: 'ready' | 'packed' | 'shipped';
  createdAt: string;
}

export interface FulfillmentOrderCardProps {
  order: FulfillmentOrder;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onPrintSlip: () => void;
  onMarkPacked: () => void;
  onMarkShipped: () => void;
  onAddTracking: () => void;
}

const statusConfig = {
  ready: { label: 'NEW', className: 'bg-status-pending text-status-pending-text' },
  packed: { label: 'PACKED', className: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'SHIPPED', className: 'bg-status-success text-status-success-text' },
};

export const FulfillmentOrderCard = ({
  order,
  isSelected,
  onSelect,
  onPrintSlip,
  onMarkPacked,
  onAddTracking,
}: FulfillmentOrderCardProps) => {
  const statusStyle = statusConfig[order.status];
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-background border border-border rounded-lg p-4 hover:shadow-sm transition-shadow">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            className="mt-1"
          />
          <div>
            <span className="font-semibold text-sm text-muted-foreground">
              #{order.orderNumber}
            </span>
            <span className="text-sm text-muted-foreground"> · {formatDate(order.createdAt)}</span>
          </div>
        </div>
        <span className={`status-badge ${statusStyle.className}`}>
          {statusStyle.label}
        </span>
      </div>

      {/* Retailer Section */}
      <div className="mt-3">
        <h3 className="text-lg font-bold text-foreground">{order.retailerName}</h3>
        <div className="text-sm text-muted-foreground leading-relaxed mt-1">
          <p>{order.shippingAddress.street}</p>
          <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
          {order.shippingAddress.country && order.shippingAddress.country !== 'USA' && (
            <p>{order.shippingAddress.country}</p>
          )}
        </div>
      </div>

      {/* Items Section */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-foreground">Items</span>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
            {totalItems}
          </span>
        </div>
        <div className="space-y-1">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground truncate pr-4">{item.title}</span>
              <span className="text-lg font-bold text-foreground min-w-[40px] text-right">
                ×{item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-border flex gap-2">
        <ButtonSecondary
          onClick={onPrintSlip}
          icon={<Printer className="w-4 h-4" />}
          className="flex-1 text-sm"
        >
          Print Slip
        </ButtonSecondary>
        {order.status === 'ready' && (
          <ButtonPrimary
            onClick={onMarkPacked}
            icon={<Package className="w-4 h-4" />}
            className="flex-1 text-sm"
          >
            Mark Packed
          </ButtonPrimary>
        )}
        {order.status === 'packed' && (
          <ButtonPrimary
            onClick={onAddTracking}
            icon={<Truck className="w-4 h-4" />}
            className="flex-1 text-sm"
          >
            Add Tracking
          </ButtonPrimary>
        )}
      </div>
    </div>
  );
};
