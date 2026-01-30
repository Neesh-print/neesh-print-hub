export type StatusType =
  | 'pending'
  | 'received'
  | 'unfulfilled'
  | 'returned'
  | 'payment-sent'
  | 'payment-pending'
  | 'payment-received'
  | 'payment-not-sent'
  | 'new-order'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  'pending': {
    label: 'PENDING',
    className: 'bg-status-pending text-status-pending-text',
  },
  'received': {
    label: 'RECEIVED',
    className: 'bg-status-success text-status-success-text',
  },
  'unfulfilled': {
    label: 'UNFULFILLED',
    className: 'bg-status-error text-status-error-text',
  },
  'returned': {
    label: 'RETURNED',
    className: 'bg-status-success text-status-success-text',
  },
  'payment-sent': {
    label: 'PAYMENT SENT',
    className: 'bg-status-neutral text-status-neutral-text',
  },
  'payment-pending': {
    label: 'PAYMENT PENDING',
    className: 'bg-status-neutral text-status-neutral-text',
  },
  'payment-received': {
    label: 'PAYMENT RECEIVED',
    className: 'bg-status-success text-status-success-text',
  },
  'payment-not-sent': {
    label: 'PAYMENT NOT SENT',
    className: 'bg-status-neutral text-status-neutral-text',
  },
  'new-order': {
    label: 'NEW ORDER',
    className: 'bg-status-pending text-status-pending-text',
  },
  'shipped': {
    label: 'SHIPPED',
    className: 'bg-status-neutral text-status-neutral-text',
  },
  'delivered': {
    label: 'DELIVERED',
    className: 'bg-status-success text-status-success-text',
  },
  'cancelled': {
    label: 'CANCELLED',
    className: 'bg-status-error text-status-error-text',
  },
};

export const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <span className={`status-badge ${config.className}`}>
      {displayLabel}
    </span>
  );
};
