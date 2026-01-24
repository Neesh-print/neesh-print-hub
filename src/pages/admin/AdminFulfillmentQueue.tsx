import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Package, Truck, Printer, AlertCircle } from "lucide-react";
import { AdminLayout, StatCard, FulfillmentOrderCard, AddTrackingModal } from "@/components/admin";
import { BackNavigation, TabNavigation, ButtonPrimary, ButtonSecondary, EmptyState } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { Checkbox } from "@/components/ui/checkbox";
import type { FulfillmentOrder } from "@/components/admin/FulfillmentOrderCard";
import { toast } from "sonner";
import { useOrders } from "@/hooks/useOrders";
import { useUpdateOrderStatus } from "@/hooks/useUpdateOrderStatus";
import { startOfToday, endOfToday } from "date-fns";

const tabs = [
  { id: "pending", label: "Ready to Pack" },
  { id: "packed", label: "Packed" },
  { id: "shipped", label: "Shipped Today" },
];

export const AdminFulfillmentQueue = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trackingModalOrder, setTrackingModalOrder] = useState<FulfillmentOrder | null>(null);

  // Fetch orders by status
  // Fetch orders by status
  const pendingOptions = useMemo(() => ({ fulfillmentStatus: "pending" as const }), []);
  const { orders: pendingOrders, isLoading: pendingLoading, refetch: refetchPending } = useOrders(pendingOptions);

  const packedOptions = useMemo(() => ({ fulfillmentStatus: "packed" as const }), []);
  const { orders: packedOrders, isLoading: packedLoading, refetch: refetchPacked } = useOrders(packedOptions);

  const shippedOptions = useMemo(() => ({
    fulfillmentStatus: "shipped" as const,
    dateRange: { start: startOfToday(), end: endOfToday() },
  }), []);
  const { orders: shippedOrders, isLoading: shippedLoading, refetch: refetchShipped } = useOrders(shippedOptions);

  const { updateStatus, addTracking, isUpdating } = useUpdateOrderStatus();

  const isLoading = pendingLoading || packedLoading || shippedLoading;

  // Transform orders to FulfillmentOrder format
  const transformToFulfillmentOrder = (order: any): FulfillmentOrder => ({
    id: order.id,
    orderNumber: order.order_number.replace('#', ''),
    retailerName: order.retailer?.shop_name || 'Unknown Retailer',
    shippingAddress: {
      street: order.shipping_address || '',
      city: '',
      state: '',
      zip: '',
    },
    items: [{
      title: order.magazine?.title || 'Unknown',
      quantity: order.quantity,
    }],
    status: order.fulfillment_status === 'pending' ? 'ready' : order.fulfillment_status as 'ready' | 'packed' | 'shipped',
    createdAt: order.created_at,
  });

  const fulfillmentOrders = useMemo(() => {
    let orders: any[] = [];
    if (activeTab === "pending") orders = pendingOrders;
    else if (activeTab === "packed") orders = packedOrders;
    else if (activeTab === "shipped") orders = shippedOrders;
    return orders.map(transformToFulfillmentOrder);
  }, [activeTab, pendingOrders, packedOrders, shippedOrders]);

  // Stats
  const readyCount = pendingOrders.length;
  const packedCount = packedOrders.length;
  const shippedTodayCount = shippedOrders.length;

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(fulfillmentOrders.map((o) => o.id)));
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

  const isAllSelected = fulfillmentOrders.length > 0 && fulfillmentOrders.every((o) => selectedIds.has(o.id));

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

  const handleMarkPacked = async (orderId: string) => {
    const success = await updateStatus(orderId, 'packed');
    if (success) {
      toast.success("Order marked as packed");
      refetchPending();
      refetchPacked();
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleMarkSelectedPacked = async () => {
    if (selectedIds.size === 0) {
      toast.error("No orders selected");
      return;
    }
    
    const promises = Array.from(selectedIds).map(id => updateStatus(id, 'packed'));
    await Promise.all(promises);
    
    toast.success(`${selectedIds.size} orders marked as packed`);
    refetchPending();
    refetchPacked();
    setSelectedIds(new Set());
  };

  const handleAddTracking = (order: FulfillmentOrder) => {
    setTrackingModalOrder(order);
  };

  const handleSubmitTracking = async (trackingData: { carrier: string; trackingNumber: string }) => {
    if (!trackingModalOrder) return;
    
    const success = await addTracking(trackingModalOrder.id, trackingData.carrier, trackingData.trackingNumber);
    
    if (success) {
      toast.success(`Order #${trackingModalOrder.orderNumber} marked as shipped with ${trackingData.carrier} tracking`);
      refetchPacked();
      refetchShipped();
    }
    
    setTrackingModalOrder(null);
  };

  // Clear selection when changing tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Loading fulfillment queue..." />
      </AdminLayout>
    );
  }

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
            onClick={() => setActiveTab("pending")}
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
      {fulfillmentOrders.length > 0 && (
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
            {activeTab === "pending" && (
              <ButtonPrimary
                onClick={handleMarkSelectedPacked}
                icon={<Package className="w-4 h-4" />}
                disabled={selectedIds.size === 0 || isUpdating}
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
      {fulfillmentOrders.length === 0 ? (
          <EmptyState
            icon={
              activeTab === "pending" ? (
                <CheckCircle className="w-12 h-12 text-status-success" />
              ) : activeTab === "packed" ? (
                <Package className="w-12 h-12 text-muted-foreground" />
              ) : (
                <Truck className="w-12 h-12 text-muted-foreground" />
              )
            }
            title={
              activeTab === "pending"
                ? "All caught up"
                : activeTab === "packed"
                ? "No orders waiting for shipment"
                : "No shipments yet today"
            }
            description={
              activeTab === "pending"
                ? "No orders waiting for fulfillment"
                : activeTab === "packed"
                ? "Packed orders will appear here once you mark them as packed."
                : "Shipped orders from today will appear here."
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fulfillmentOrders.map((order) => (
              <FulfillmentOrderCard
                key={order.id}
                order={order}
                isSelected={selectedIds.has(order.id)}
                onSelect={(selected: boolean) => handleSelectOrder(order.id, selected)}
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
        isLoading={isUpdating}
      />
    </AdminLayout>
  );
};

export default AdminFulfillmentQueue;
