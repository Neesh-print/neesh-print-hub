import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Package, Truck, Printer } from "lucide-react";
import { AdminLayout, StatCard, FulfillmentOrderCard, AddTrackingModal } from "@/components/admin";
import { BackNavigation, TabNavigation, ButtonPrimary, ButtonSecondary, EmptyState } from "@/components/neesh";
import { Checkbox } from "@/components/ui/checkbox";
import type { FulfillmentOrder } from "@/components/admin/FulfillmentOrderCard";
import { toast } from "sonner";

// Mock data
const mockOrders: FulfillmentOrder[] = [
  {
    id: "1",
    orderNumber: "0052",
    retailerName: "Powell's Books",
    shippingAddress: {
      street: "1005 W Burnside St",
      city: "Portland",
      state: "OR",
      zip: "97209",
    },
    items: [
      { title: "Kinfolk Issue 45", quantity: 3 },
      { title: "Apartamento #28", quantity: 2 },
    ],
    status: "ready",
    createdAt: "2025-01-15T10:30:00Z",
  },
  {
    id: "2",
    orderNumber: "0051",
    retailerName: "McNally Jackson",
    shippingAddress: {
      street: "52 Prince St",
      city: "New York",
      state: "NY",
      zip: "10012",
    },
    items: [
      { title: "Cereal Magazine Vol. 21", quantity: 5 },
    ],
    status: "ready",
    createdAt: "2025-01-15T09:15:00Z",
  },
  {
    id: "3",
    orderNumber: "0050",
    retailerName: "City Lights Bookstore",
    shippingAddress: {
      street: "261 Columbus Ave",
      city: "San Francisco",
      state: "CA",
      zip: "94133",
    },
    items: [
      { title: "The Gourmand Issue 19", quantity: 2 },
      { title: "Drift Vol. 12", quantity: 4 },
      { title: "MacGuffin #14", quantity: 1 },
    ],
    status: "ready",
    createdAt: "2025-01-14T16:45:00Z",
  },
  {
    id: "4",
    orderNumber: "0049",
    retailerName: "Skylight Books",
    shippingAddress: {
      street: "1818 N Vermont Ave",
      city: "Los Angeles",
      state: "CA",
      zip: "90027",
    },
    items: [
      { title: "Offscreen Magazine #23", quantity: 3 },
    ],
    status: "ready",
    createdAt: "2025-01-14T14:20:00Z",
  },
  {
    id: "5",
    orderNumber: "0048",
    retailerName: "The Strand",
    shippingAddress: {
      street: "828 Broadway",
      city: "New York",
      state: "NY",
      zip: "10003",
    },
    items: [
      { title: "Eye on Design Issue 8", quantity: 4 },
      { title: "Works That Work #9", quantity: 2 },
    ],
    status: "packed",
    createdAt: "2025-01-14T11:00:00Z",
  },
  {
    id: "6",
    orderNumber: "0047",
    retailerName: "Rare Device",
    shippingAddress: {
      street: "600 Divisadero St",
      city: "San Francisco",
      state: "CA",
      zip: "94117",
    },
    items: [
      { title: "Hole & Corner Issue 18", quantity: 2 },
    ],
    status: "packed",
    createdAt: "2025-01-13T15:30:00Z",
  },
  {
    id: "7",
    orderNumber: "0046",
    retailerName: "Mast Books",
    shippingAddress: {
      street: "72 Ave A",
      city: "New York",
      state: "NY",
      zip: "10009",
    },
    items: [
      { title: "Apartamento #28", quantity: 3 },
    ],
    status: "packed",
    createdAt: "2025-01-13T10:15:00Z",
  },
  {
    id: "8",
    orderNumber: "0045",
    retailerName: "Kinokuniya",
    shippingAddress: {
      street: "1073 Avenue of the Americas",
      city: "New York",
      state: "NY",
      zip: "10018",
    },
    items: [
      { title: "Kinfolk Issue 45", quantity: 10 },
      { title: "Cereal Magazine Vol. 21", quantity: 8 },
    ],
    status: "shipped",
    createdAt: "2025-01-16T08:00:00Z",
  },
  {
    id: "9",
    orderNumber: "0044",
    retailerName: "Bluestockings",
    shippingAddress: {
      street: "116 Suffolk St",
      city: "New York",
      state: "NY",
      zip: "10002",
    },
    items: [
      { title: "Offscreen Magazine #23", quantity: 2 },
    ],
    status: "shipped",
    createdAt: "2025-01-16T07:45:00Z",
  },
  {
    id: "10",
    orderNumber: "0043",
    retailerName: "Elliott Bay Book Company",
    shippingAddress: {
      street: "1521 10th Ave",
      city: "Seattle",
      state: "WA",
      zip: "98122",
    },
    items: [
      { title: "The Gourmand Issue 19", quantity: 4 },
      { title: "MacGuffin #14", quantity: 3 },
    ],
    status: "shipped",
    createdAt: "2025-01-16T07:30:00Z",
  },
  {
    id: "11",
    orderNumber: "0042",
    retailerName: "Third Place Books",
    shippingAddress: {
      street: "17171 Bothell Way NE",
      city: "Lake Forest Park",
      state: "WA",
      zip: "98155",
    },
    items: [
      { title: "Drift Vol. 12", quantity: 2 },
    ],
    status: "shipped",
    createdAt: "2025-01-16T07:00:00Z",
  },
  {
    id: "12",
    orderNumber: "0041",
    retailerName: "Book Larder",
    shippingAddress: {
      street: "4252 Fremont Ave N",
      city: "Seattle",
      state: "WA",
      zip: "98103",
    },
    items: [
      { title: "The Gourmand Issue 19", quantity: 6 },
    ],
    status: "shipped",
    createdAt: "2025-01-16T06:30:00Z",
  },
];

const tabs = [
  { id: "ready", label: "Ready to Pack" },
  { id: "packed", label: "Packed" },
  { id: "shipped", label: "Shipped Today" },
];

export const AdminFulfillmentQueue = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ready");
  const [orders, setOrders] = useState<FulfillmentOrder[]>(mockOrders);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trackingModalOrder, setTrackingModalOrder] = useState<FulfillmentOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter orders by tab
  const filteredOrders = useMemo(() => {
    if (activeTab === "shipped") {
      // Only show shipped orders from today
      const today = new Date().toDateString();
      return orders.filter(
        (o) => o.status === "shipped" && new Date(o.createdAt).toDateString() === today
      );
    }
    return orders.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  // Stats
  const readyCount = orders.filter((o) => o.status === "ready").length;
  const packedCount = orders.filter((o) => o.status === "packed").length;
  const today = new Date().toDateString();
  const shippedTodayCount = orders.filter(
    (o) => o.status === "shipped" && new Date(o.createdAt).toDateString() === today
  ).length;

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOrder = (id: string, selected: boolean) => {
    const newSet = new Set(selectedIds);
    if (selected) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id));

  // Action handlers
  const handlePrintSlip = (orderId: string) => {
    navigate(`/admin/fulfillment/print?orders=${orderId}`);
  };

  const handlePrintSelected = () => {
    if (selectedIds.size === 0) {
      toast.error("No orders selected");
      return;
    }
    const orderIds = Array.from(selectedIds).join(",");
    navigate(`/admin/fulfillment/print?orders=${orderIds}`);
  };

  const handleMarkPacked = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "packed" as const } : o))
    );
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(orderId);
      return newSet;
    });
    toast.success("Order marked as packed");
  };

  const handleMarkSelectedPacked = () => {
    if (selectedIds.size === 0) {
      toast.error("No orders selected");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (selectedIds.has(o.id) && o.status === "ready" ? { ...o, status: "packed" as const } : o))
    );
    toast.success(`${selectedIds.size} orders marked as packed`);
    setSelectedIds(new Set());
  };

  const handleAddTracking = (order: FulfillmentOrder) => {
    setTrackingModalOrder(order);
  };

  const handleSubmitTracking = async (trackingData: { carrier: string; trackingNumber: string }) => {
    if (!trackingModalOrder) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setOrders((prev) =>
      prev.map((o) =>
        o.id === trackingModalOrder.id
          ? { ...o, status: "shipped" as const, createdAt: new Date().toISOString() }
          : o
      )
    );
    
    setIsSubmitting(false);
    setTrackingModalOrder(null);
    toast.success(`Order #${trackingModalOrder.orderNumber} marked as shipped with ${trackingData.carrier} tracking`);
  };

  // Clear selection when changing tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedIds(new Set());
  };

  return (
    <AdminLayout>
      <BackNavigation title="Fulfillment" onBack={() => navigate("/admin")} />

      {/* Stats Row */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Ready to Pack"
            value={readyCount}
            highlight={readyCount > 0 ? "warning" : undefined}
            onClick={() => setActiveTab("ready")}
          />
          <StatCard
            label="Packed & Ready"
            value={packedCount}
            onClick={() => setActiveTab("packed")}
          />
          <StatCard
            label="Shipped Today"
            value={shippedTodayCount}
            onClick={() => setActiveTab("shipped")}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Bulk Action Bar */}
      {filteredOrders.length > 0 && (
        <div className="px-4 md:px-6 py-4 border-b border-border flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
            <span className="text-sm font-medium text-foreground">Select All</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            <ButtonSecondary
              onClick={handlePrintSelected}
              icon={<Printer className="w-4 h-4" />}
              disabled={selectedIds.size === 0}
              className="text-sm"
            >
              Print Selected Slips
            </ButtonSecondary>
            {activeTab === "ready" && (
              <ButtonPrimary
                onClick={handleMarkSelectedPacked}
                icon={<Package className="w-4 h-4" />}
                disabled={selectedIds.size === 0}
                className="text-sm"
              >
                Mark Selected as Packed
              </ButtonPrimary>
            )}
          </div>
        </div>
      )}

      {/* Orders Grid */}
      <div className="px-4 md:px-6 py-6">
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={
              activeTab === "ready" ? (
                <CheckCircle className="w-12 h-12 text-status-success" />
              ) : activeTab === "packed" ? (
                <Package className="w-12 h-12 text-muted-foreground" />
              ) : (
                <Truck className="w-12 h-12 text-muted-foreground" />
              )
            }
            title={
              activeTab === "ready"
                ? "All orders packed!"
                : activeTab === "packed"
                ? "No orders waiting for shipment"
                : "No shipments yet today"
            }
            description={
              activeTab === "ready"
                ? "Great job! All orders have been packed and are ready for shipping."
                : activeTab === "packed"
                ? "Packed orders will appear here once you mark them as packed."
                : "Shipped orders from today will appear here."
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((order) => (
              <FulfillmentOrderCard
                key={order.id}
                order={order}
                isSelected={selectedIds.has(order.id)}
                onSelect={(selected) => handleSelectOrder(order.id, selected)}
                onPrintSlip={() => handlePrintSlip(order.id)}
                onMarkPacked={() => handleMarkPacked(order.id)}
                onMarkShipped={() => {}}
                onAddTracking={() => handleAddTracking(order)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Tracking Modal */}
      <AddTrackingModal
        isOpen={!!trackingModalOrder}
        onClose={() => setTrackingModalOrder(null)}
        onSubmit={handleSubmitTracking}
        orderNumber={trackingModalOrder?.orderNumber || ""}
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
};

export default AdminFulfillmentQueue;
