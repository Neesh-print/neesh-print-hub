import neeshLogo from '@/assets/neesh-logo.png';

export interface PackingSlipItem {
  title: string;
  publisher: string;
  quantity: number;
}

export interface PackingSlipOrder {
  orderNumber: string;
  createdAt: string;
  retailerName: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  items: PackingSlipItem[];
}

export interface PackingSlipProps {
  order: PackingSlipOrder;
}

export const PackingSlip = ({ order }: PackingSlipProps) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="packing-slip bg-white p-6 max-w-[6in] mx-auto font-sans text-black">
      {/* Header */}
      <div className="text-center mb-4">
        <img src={neeshLogo} alt="Neesh" className="h-6 mx-auto" />
        <p className="text-sm text-gray-600 mt-1">Packing Slip</p>
        <hr className="border-t border-gray-300 mt-3" />
      </div>

      {/* Order Info Row */}
      <div className="flex justify-between items-center mb-4 text-sm">
        <span className="font-semibold">Order #{order.orderNumber}</span>
        <span className="text-gray-600">{formatDate(order.createdAt)}</span>
      </div>

      {/* Ship To Section */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Ship To:</p>
        <p className="font-bold text-base">{order.retailerName}</p>
        <div className="text-sm text-gray-700 mt-1 leading-relaxed">
          <p>{order.shippingAddress.street}</p>
          <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
          {order.shippingAddress.country && order.shippingAddress.country !== 'USA' && (
            <p>{order.shippingAddress.country}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-2 font-semibold">Item</th>
            <th className="text-right py-2 font-semibold w-16">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={index} className="border-b border-gray-200">
              <td className="py-2">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-gray-500">{item.publisher}</div>
              </td>
              <td className="text-right py-2 font-bold">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-300 text-center text-sm text-gray-600">
        <p className="font-medium">Thank you for your order!</p>
        <p className="mt-1">Questions? hi@neesh.art</p>
      </div>
    </div>
  );
};

// Print styles - these get injected into the page
export const packingSlipPrintStyles = `
@media print {
  body * {
    visibility: hidden;
  }
  
  .print-container,
  .print-container * {
    visibility: visible;
  }
  
  .print-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
  
  .packing-slip {
    page-break-after: always;
    page-break-inside: avoid;
  }
  
  .packing-slip:last-child {
    page-break-after: auto;
  }
  
  .no-print {
    display: none !important;
  }
  
  @page {
    margin: 0.5in;
    size: letter;
  }
}
`;
