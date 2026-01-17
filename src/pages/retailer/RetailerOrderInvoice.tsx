import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { format } from "date-fns";
import neeshLogo from "@/assets/neesh-logo.png";

// Mock order data - will be replaced with real data fetch
const MOCK_ORDER = {
  id: 'ORD-789',
  invoiceNumber: 'INV-789',
  created_at: '2026-01-17T15:30:00Z',
  status: 'shipped',
  paymentStatus: 'paid',
  paymentMethod: 'Visa ending in 4242',
  items: [
    {
      id: 'item-1',
      title: 'Wax Poetics Issue 75',
      publisher: 'Wax Poetics',
      quantity: 3,
      unit_price: 11.99,
      total: 35.97,
    },
    {
      id: 'item-2',
      title: 'Mushroom People Volume 2',
      publisher: 'Broccoli Publishing',
      quantity: 2,
      unit_price: 16.79,
      total: 33.58,
    },
    {
      id: 'item-3',
      title: 'Kinfolk Issue 45',
      publisher: 'Kinfolk Publishing',
      quantity: 5,
      unit_price: 18.00,
      total: 90.00,
    },
  ],
  subtotal: 159.55,
  shipping: 12.50,
  tax: 0,
  total: 172.05,
  billing_address: {
    business_name: 'Commonplace Books',
    contact_name: 'Michael Torres',
    email: 'orders@commonplacebooks.com',
    street: '1234 Main Street',
    city: 'Denver',
    state: 'CO',
    postal_code: '80202',
    country: 'United States',
  },
  shipping_address: {
    business_name: 'Commonplace Books',
    attention: 'Michael Torres',
    street: '1234 Main Street',
    city: 'Denver',
    state: 'CO',
    postal_code: '80202',
    country: 'United States',
  },
};

export const RetailerOrderInvoice = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // TODO: Fetch real order data based on id
  const order = MOCK_ORDER;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation using @react-pdf/renderer or similar
    // For now, just trigger print dialog which allows "Save as PDF"
    window.print();
  };

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Action Bar - Hidden in print */}
      <div className="no-print sticky top-0 z-10 bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(`/retailer/orders/${id}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Order
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Container */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 print:p-0 print:max-w-none">
        <div className="invoice-container bg-white rounded-lg shadow-sm border print:shadow-none print:border-0 print:rounded-none">
          <div className="p-8 md:p-12 print:p-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-8 pb-8 border-b">
              <div>
                <img 
                  src={neeshLogo} 
                  alt="Neesh" 
                  className="h-8 md:h-10 print:h-8"
                />
              </div>
              <div className="text-right">
                <p className="text-2xl font-display font-bold text-muted-foreground mb-2">INVOICE</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Invoice #:</span>{" "}
                  <span className="font-medium">{order.invoiceNumber}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="font-medium">{format(new Date(order.created_at), 'MMMM d, yyyy')}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Due:</span>{" "}
                  <span className={`font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : ''}`}>
                    {order.paymentStatus === 'paid' ? 'Paid' : 'Due on Receipt'}
                  </span>
                </p>
              </div>
            </div>

            {/* Bill To / Ship To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Bill To
                </h3>
                <p className="font-medium">{order.billing_address.business_name}</p>
                <p className="text-muted-foreground">{order.billing_address.contact_name}</p>
                <p className="text-muted-foreground">{order.billing_address.email}</p>
                <p className="text-muted-foreground mt-2">{order.billing_address.street}</p>
                <p className="text-muted-foreground">
                  {order.billing_address.city}, {order.billing_address.state} {order.billing_address.postal_code}
                </p>
                <p className="text-muted-foreground">{order.billing_address.country}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Ship To
                </h3>
                <p className="font-medium">{order.shipping_address.business_name}</p>
                {order.shipping_address.attention && (
                  <p className="text-muted-foreground">Attn: {order.shipping_address.attention}</p>
                )}
                <p className="text-muted-foreground mt-2">{order.shipping_address.street}</p>
                <p className="text-muted-foreground">
                  {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
                </p>
                <p className="text-muted-foreground">{order.shipping_address.country}</p>
              </div>
            </div>

            {/* Order Details */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Order #:</span>{" "}
                  <span className="font-medium">{order.id}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Order Date:</span>{" "}
                  <span className="font-medium">{format(new Date(order.created_at), 'MMMM d, yyyy')}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Payment:</span>{" "}
                  <span className="font-medium">{order.paymentMethod}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className={`font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                    {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-8 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-t">
                    <th className="text-left py-3 font-semibold">Item</th>
                    <th className="text-left py-3 font-semibold">Publisher</th>
                    <th className="text-center py-3 font-semibold">Qty</th>
                    <th className="text-right py-3 font-semibold">Unit Price</th>
                    <th className="text-right py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr 
                      key={item.id} 
                      className={`border-b ${index % 2 === 1 ? 'bg-muted/30 print:bg-gray-50' : ''}`}
                    >
                      <td className="py-3 pr-4">{item.title}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{item.publisher}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-right">{formatPrice(item.unit_price)}</td>
                      <td className="py-3 text-right font-medium">{formatPrice(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-12">
              <div className="w-full md:w-64">
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatPrice(order.shipping)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatPrice(order.tax)}</span>
                </div>
                <div className="flex justify-between py-3 border-t mt-2 font-display font-bold text-lg">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center border-t pt-8">
              <p className="font-medium text-foreground mb-2">
                Thank you for supporting independent print!
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <a href="mailto:hi@neesh.art" className="hover:text-foreground">hi@neesh.art</a>
                  {" · "}
                  <a href="https://neesh.art" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">neesh.art</a>
                </p>
                <p className="text-xs mt-4 max-w-md mx-auto">
                  This invoice was generated by Neesh. For questions about this order, 
                  contact the publisher directly or email us.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
          
          body {
            font-size: 11pt;
            color: black;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .no-print {
            display: none !important;
          }
          
          .invoice-container {
            max-width: 100%;
            padding: 0;
            box-shadow: none;
            border: none;
          }
        }
      `}</style>
    </div>
  );
};

// TODO: Publisher invoice view at /publisher/orders/:orderId/invoice
// Shows same info from publisher's perspective
