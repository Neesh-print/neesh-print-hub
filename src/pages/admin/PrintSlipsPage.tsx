import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { PackingSlip, packingSlipPrintStyles } from "@/components/admin/PackingSlip";
import { ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import type { PackingSlipOrder } from "@/components/admin/PackingSlip";

// Mock order data - in real app, fetch based on IDs
const mockOrderData: Record<string, PackingSlipOrder> = {
  "1": {
    orderNumber: "0052",
    createdAt: "2025-01-15T10:30:00Z",
    retailerName: "Powell's Books",
    shippingAddress: {
      street: "1005 W Burnside St",
      city: "Portland",
      state: "OR",
      zip: "97209",
    },
    items: [
      { title: "Kinfolk Issue 45", publisher: "Kinfolk Magazine", quantity: 3 },
      { title: "Apartamento #28", publisher: "Apartamento Publishing", quantity: 2 },
    ],
  },
  "2": {
    orderNumber: "0051",
    createdAt: "2025-01-15T09:15:00Z",
    retailerName: "McNally Jackson",
    shippingAddress: {
      street: "52 Prince St",
      city: "New York",
      state: "NY",
      zip: "10012",
    },
    items: [
      { title: "Cereal Magazine Vol. 21", publisher: "Cereal Magazine", quantity: 5 },
    ],
  },
  "3": {
    orderNumber: "0050",
    createdAt: "2025-01-14T16:45:00Z",
    retailerName: "City Lights Bookstore",
    shippingAddress: {
      street: "261 Columbus Ave",
      city: "San Francisco",
      state: "CA",
      zip: "94133",
    },
    items: [
      { title: "The Gourmand Issue 19", publisher: "The Gourmand", quantity: 2 },
      { title: "Drift Vol. 12", publisher: "Drift Magazine", quantity: 4 },
      { title: "MacGuffin #14", publisher: "MacGuffin Magazine", quantity: 1 },
    ],
  },
  "4": {
    orderNumber: "0049",
    createdAt: "2025-01-14T14:20:00Z",
    retailerName: "Skylight Books",
    shippingAddress: {
      street: "1818 N Vermont Ave",
      city: "Los Angeles",
      state: "CA",
      zip: "90027",
    },
    items: [
      { title: "Offscreen Magazine #23", publisher: "Offscreen Magazine", quantity: 3 },
    ],
  },
  "5": {
    orderNumber: "0048",
    createdAt: "2025-01-14T11:00:00Z",
    retailerName: "The Strand",
    shippingAddress: {
      street: "828 Broadway",
      city: "New York",
      state: "NY",
      zip: "10003",
    },
    items: [
      { title: "Eye on Design Issue 8", publisher: "AIGA", quantity: 4 },
      { title: "Works That Work #9", publisher: "Works That Work", quantity: 2 },
    ],
  },
  "6": {
    orderNumber: "0047",
    createdAt: "2025-01-13T15:30:00Z",
    retailerName: "Rare Device",
    shippingAddress: {
      street: "600 Divisadero St",
      city: "San Francisco",
      state: "CA",
      zip: "94117",
    },
    items: [
      { title: "Hole & Corner Issue 18", publisher: "Hole & Corner", quantity: 2 },
    ],
  },
  "7": {
    orderNumber: "0046",
    createdAt: "2025-01-13T10:15:00Z",
    retailerName: "Mast Books",
    shippingAddress: {
      street: "72 Ave A",
      city: "New York",
      state: "NY",
      zip: "10009",
    },
    items: [
      { title: "Apartamento #28", publisher: "Apartamento Publishing", quantity: 3 },
    ],
  },
};

export const PrintSlipsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Parse order IDs from query params
  const orderIds = useMemo(() => {
    const ordersParam = searchParams.get("orders");
    if (!ordersParam) return [];
    return ordersParam.split(",").filter(Boolean);
  }, [searchParams]);

  // Get orders data
  const orders = useMemo(() => {
    return orderIds
      .map((id) => mockOrderData[id])
      .filter(Boolean);
  }, [orderIds]);

  // Inject print styles on mount
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.id = "packing-slip-print-styles";
    styleElement.textContent = packingSlipPrintStyles;
    document.head.appendChild(styleElement);

    return () => {
      const existingStyle = document.getElementById("packing-slip-print-styles");
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">No orders found to print</p>
          <ButtonSecondary onClick={() => navigate("/admin/fulfillment")}>
            Back to Fulfillment
          </ButtonSecondary>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - hidden when printing */}
      <div className="no-print sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <ButtonSecondary
            onClick={() => navigate("/admin/fulfillment")}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Fulfillment
          </ButtonSecondary>
          <ButtonPrimary
            onClick={handlePrint}
            icon={<Printer className="w-4 h-4" />}
          >
            Print All Slips ({orders.length})
          </ButtonPrimary>
        </div>
      </div>

      {/* Packing Slips */}
      <div className="print-container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {orders.map((order) => (
            <div key={order.orderNumber} className="shadow-lg no-print:shadow-lg">
              <PackingSlip order={order} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrintSlipsPage;
