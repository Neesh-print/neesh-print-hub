import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, List, Search, ArrowUpDown, SlidersHorizontal, Check, ShoppingBag } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, TabNavigation, DataTable, StatusBadge, EmptyState, ButtonPrimary } from "@/components/neesh";
import type { DataTableColumn } from "@/components/neesh";
import type { StatusType } from "@/components/neesh/StatusBadge";

interface Order {
  [key: string]: unknown;
  id: string;
  publisher: string;
  total: number;
  time: string;
  date: string;
  quantity: number;
  shipping: string;
  paymentStatus: "paid" | "pending";
  fulfillmentStatus: "pending" | "received" | "unfulfilled";
}

const mockOrders: Order[] = [
  { id: "#0001", publisher: "Weird Walk", total: 26.43, time: "2 hours ago", date: "Jan 15, 2026", quantity: 3, shipping: "Standard", paymentStatus: "paid", fulfillmentStatus: "received" },
  { id: "#0002", publisher: "Apartamento", total: 54.00, time: "5 hours ago", date: "Jan 15, 2026", quantity: 3, shipping: "Express", paymentStatus: "paid", fulfillmentStatus: "pending" },
  { id: "#0003", publisher: "MacGuffin", total: 67.50, time: "1 day ago", date: "Jan 14, 2026", quantity: 3, shipping: "Standard", paymentStatus: "pending", fulfillmentStatus: "unfulfilled" },
  { id: "#0004", publisher: "Kinfolk", total: 96.00, time: "2 days ago", date: "Jan 13, 2026", quantity: 4, shipping: "Standard", paymentStatus: "paid", fulfillmentStatus: "received" },
  { id: "#0005", publisher: "Cabana", total: 180.00, time: "3 days ago", date: "Jan 12, 2026", quantity: 4, shipping: "Express", paymentStatus: "paid", fulfillmentStatus: "received" },
  { id: "#0006", publisher: "Monocle", total: 45.00, time: "4 days ago", date: "Jan 11, 2026", quantity: 3, shipping: "Standard", paymentStatus: "pending", fulfillmentStatus: "pending" },
  { id: "#0007", publisher: "The Gourmand", total: 60.00, time: "5 days ago", date: "Jan 10, 2026", quantity: 3, shipping: "Standard", paymentStatus: "paid", fulfillmentStatus: "unfulfilled" },
  { id: "#0008", publisher: "Offscreen", total: 76.00, time: "1 week ago", date: "Jan 8, 2026", quantity: 4, shipping: "Express", paymentStatus: "paid", fulfillmentStatus: "received" },
];

const tabs = [
  { id: "orders", label: "My Orders" },
  { id: "returns", label: "My Returns" },
];

export const RetailerOrdersList = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"compact" | "comfortable">("comfortable");

  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedOrders(selectedIds);
  };

  const filteredOrders = mockOrders.filter(order =>
    order.publisher.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: DataTableColumn<Order>[] = [
    {
      key: "id",
      header: "Order",
      render: (_, row) => <span className="font-medium">{row.id}</span>,
    },
    {
      key: "publisher",
      header: "Publisher",
      sortable: true,
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (_, row) => `$${row.total.toFixed(2)}`,
    },
    {
      key: "time",
      header: "Time",
      render: (_, row) => (
        <div>
          <span className="block">{row.time}</span>
          <span className="text-xs text-muted-foreground">{row.date}</span>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      align: "center",
    },
    {
      key: "shipping",
      header: "Shipping",
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (_, row) => {
        const status: StatusType = row.paymentStatus === "paid" ? "payment-sent" : "payment-pending";
        const label = row.paymentStatus === "paid" ? "PAYMENT SENT" : "PAYMENT PENDING";
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={status} label={label} />
            {row.paymentStatus === "paid" && (
              <Check className="w-4 h-4 text-green-600" />
            )}
          </div>
        );
      },
    },
    {
      key: "fulfillmentStatus",
      header: "Fulfillment",
      render: (_, row) => {
        const statusMap: Record<string, { status: StatusType; label: string }> = {
          pending: { status: "pending", label: "PENDING" },
          received: { status: "received", label: "RECEIVED" },
          unfulfilled: { status: "unfulfilled", label: "UNFULFILLED" },
        };
        const config = statusMap[row.fulfillmentStatus];
        return <StatusBadge status={config.status} label={config.label} />;
      },
    },
  ];

  return (
    <RetailerLayout>
      <BackNavigation
        title="My Orders"
        onBack={() => navigate("/retailer")}
      />

      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="px-4 md:px-6 py-6">
        {/* Controls Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {/* Density Toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("compact")}
                className={`p-2 transition-colors ${viewMode === "compact" ? "bg-secondary" : "hover:bg-secondary/50"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("comfortable")}
                className={`p-2 transition-colors ${viewMode === "comfortable" ? "bg-secondary" : "hover:bg-secondary/50"}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm w-48"
              />
            </div>

            {/* Sort */}
            <button className="p-2 border border-border rounded-lg hover:bg-secondary transition-colors">
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Filter */}
            <button className="p-2 border border-border rounded-lg hover:bg-secondary transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-12 h-12" />}
            title={searchQuery ? "No orders found" : "No orders yet"}
            description={searchQuery ? "Try adjusting your search" : "Browse the catalogue to discover magazines for your store"}
            action={!searchQuery ? (
              <ButtonPrimary onClick={() => navigate("/retailer")}>
                Browse Catalogue
              </ButtonPrimary>
            ) : undefined}
          />
        ) : (
          <DataTable<Order>
            columns={columns}
            data={filteredOrders}
            selectable
            selectedRows={selectedOrders}
            onSelectionChange={handleSelectionChange}
            onRowClick={(order) => navigate(`/retailer/orders/${order.id.replace("#", "")}`)}
          />
        )}
      </div>
    </RetailerLayout>
  );
};
