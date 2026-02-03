import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Download, Package, AlertCircle } from "lucide-react";
import { AdminLayout, StatCard, DateRangePicker } from "@/components/admin";
import { BackNavigation, TabNavigation, DataTable, StatusBadge, ButtonPrimary, ButtonSecondary, FormInput } from "@/components/neesh";
import { useOrders } from "@/hooks/useOrders";
import { format } from "date-fns";

const tabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "returned", label: "Returned" },
];

export const AdminOrders = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  const { orders, isLoading, error, refetch } = useOrders({ dateRange });

  const filteredOrders = useMemo(() => {
    return orders
      .map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        retailer: order.retailer?.shop_name || "Unknown Retailer",
        publisher: order.magazine?.title || "Unknown",
        total: order.total_amount,
        orderDate: order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "",
        paymentStatus: order.payment_status === "paid" ? "payment-received" as const : "payment-pending" as const,
        fulfillmentStatus: order.fulfillment_status === "delivered" || order.fulfillment_status === "shipped"
          ? "received" as const
          : order.fulfillment_status === "pending"
            ? "pending" as const
            : "unfulfilled" as const,
        [Symbol.toPrimitive]: undefined,
      }))
      .filter((order) => {
        const matchesSearch =
          order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.retailer.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.publisher.toLowerCase().includes(searchTerm.toLowerCase());

        if (activeTab === "all") return matchesSearch;
        if (activeTab === "pending") return matchesSearch && order.fulfillmentStatus === "pending";
        if (activeTab === "fulfilled") return matchesSearch && order.fulfillmentStatus === "received";
        if (activeTab === "returned") return matchesSearch && order.fulfillmentStatus === "unfulfilled";
        return matchesSearch;
      });
  }, [orders, searchTerm, activeTab]);

  const totalOrders = orders.length;
  const pendingFulfillment = orders.filter(o => o.fulfillment_status === 'pending').length;
  const shippedThisWeek = orders.filter(o => {
    if (o.fulfillment_status !== 'shipped' && o.fulfillment_status !== 'delivered') return false;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(o.created_at) > weekAgo;
  }).length;
  const revenueThisMonth = orders.reduce((sum, o) => sum + o.total_amount, 0);

  const columns = [
    { key: "orderNumber", header: "Order #", sortable: true },
    { key: "retailer", header: "Retailer" },
    { key: "publisher", header: "Publisher" },
    {
      key: "total",
      header: "Total",
      align: "right" as const,
      render: (value: unknown) => `$${(value as number).toFixed(2)}`
    },
    { key: "orderDate", header: "Date", sortable: true },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (value: unknown) => <StatusBadge status={value as 'payment-received' | 'payment-pending' | 'payment-sent'} />
    },
    {
      key: "fulfillmentStatus",
      header: "Fulfillment",
      render: (value: unknown) => <StatusBadge status={value as 'received' | 'pending' | 'unfulfilled' | 'returned'} />
    },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (_: unknown, row: Record<string, unknown>) => (
        <ButtonSecondary
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/orders/${row.id}`);
          }}
          className="text-caption py-1 px-3"
        >
          View
        </ButtonSecondary>
      ),
    },
  ];

  if (error) {
    return (
      <AdminLayout>
        <BackNavigation title="All Orders" onBack={() => navigate("/admin")} />
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-status-error-text mb-3" />
            <h3 className="font-display font-semibold text-heading text-foreground mb-1">Something went wrong</h3>
            <p className="text-body text-muted-foreground mb-4">{error}</p>
            <ButtonSecondary onClick={refetch}>Try Again</ButtonSecondary>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <BackNavigation title="All Orders" onBack={() => navigate("/admin")} />

      {/* Stats Row */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Orders" value={totalOrders} />
          <StatCard
            label="Pending Fulfillment"
            value={pendingFulfillment}
            highlight={pendingFulfillment > 0 ? 'warning' : 'default'}
          />
          <StatCard label="Shipped This Week" value={shippedThisWeek} />
          <StatCard label="Revenue This Month" value={`$${revenueThisMonth.toLocaleString()}`} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-6 pb-4">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* View Controls */}
      <div className="px-4 md:px-6 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <FormInput
              placeholder="Search by order #, retailer, publisher..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="pl-10"
            />
          </div>
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={(start, end) => setDateRange({ start, end })}
          />
          <ButtonSecondary className="gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </ButtonSecondary>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="px-4 md:px-6 pb-4">
          <div className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
            <span className="text-body font-medium">{selectedRows.length} selected</span>
            <ButtonPrimary className="py-1.5">
              Mark as Shipped
            </ButtonPrimary>
            <ButtonSecondary className="py-1.5 gap-2">
              <Download className="w-4 h-4" />
              Export Selected
            </ButtonSecondary>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="px-4 md:px-6 pb-8">
        <div className="card-neesh">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-center">
                <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-body text-muted-foreground">Loading orders...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-display font-semibold text-heading text-foreground mb-1">
                {searchTerm || activeTab !== "all" ? "No orders match your filters" : "No orders yet"}
              </h3>
              <p className="text-body text-muted-foreground">
                {searchTerm || activeTab !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Orders will appear here once retailers start placing them"}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredOrders as unknown as Record<string, unknown>[]}
              selectable
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
              onRowClick={(row) => navigate(`/admin/orders/${row.id}`)}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
