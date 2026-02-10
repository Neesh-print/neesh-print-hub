import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, List, Search, ArrowUpDown, SlidersHorizontal, Check, ShoppingBag } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, TabNavigation, DataTable, StatusBadge, EmptyState, ButtonPrimary } from "@/components/neesh";
import { useOrders, type Order } from "@/hooks/useOrders";
import { useRetailerProfile } from "@/hooks/useRetailerProfile";
import { formatDistanceToNow } from "date-fns";
import type { DataTableColumn } from "@/components/neesh";
import type { StatusType } from "@/components/neesh/StatusBadge";

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

  // Fetch retailer profile and orders
  const { retailer } = useRetailerProfile();
  const { orders, isLoading, error } = useOrders({ retailerId: retailer?.user_id });

  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedOrders(selectedIds);
  };

  // Client-side filtering
  const filteredOrders = orders.filter(order =>
    order.magazine?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const columns: DataTableColumn<Order>[] = [
    {
      key: "order_number",
      header: "Order",
      render: (_, row) => <span className="font-medium">{row.order_number}</span>,
    },
    {
      key: "magazine",
      header: "Magazine",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.magazine?.cover_image_url && (
            <div className="w-8 h-10 rounded overflow-hidden bg-secondary flex-shrink-0">
              <img
                src={row.magazine.cover_image_url}
                alt={row.magazine.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <span>{row.magazine?.title || "Unknown Magazine"}</span>
        </div>
      ),
    },
    {
      key: "total_amount",
      header: "Total",
      sortable: true,
      render: (_, row) => formatPrice(row.total_amount),
    },
    {
      key: "created_at",
      header: "Time",
      render: (_, row) => {
        const date = new Date(row.created_at);
        const timeAgo = formatDistanceToNow(date, { addSuffix: true });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return (
          <div>
            <span className="block">{timeAgo}</span>
            <span className="text-xs text-muted-foreground">{dateStr}</span>
          </div>
        );
      },
    },
    {
      key: "quantity",
      header: "Qty",
      align: "center",
    },
    {
      key: "payment_status",
      header: "Payment",
      render: (_, row) => {
        const isPaid = row.payment_status === "paid";
        const status: StatusType = isPaid ? "payment-sent" : "payment-pending";
        const label = isPaid ? "PAYMENT SENT" : "PAYMENT PENDING";
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={status} label={label} />
            {isPaid && <Check className="w-4 h-4 text-green-600" />}
          </div>
        );
      },
    },
    {
      key: "fulfillment_status",
      header: "Fulfillment",
      render: (_, row) => {
        const statusMap: Record<string, { status: StatusType; label: string }> = {
          pending: { status: "pending", label: "PENDING" },
          paid: { status: "pending", label: "PENDING" },
          packed: { status: "pending", label: "PACKED" },
          shipped: { status: "received", label: "SHIPPED" },
          delivered: { status: "received", label: "DELIVERED" },
        };
        const config = statusMap[row.fulfillment_status] || { status: "pending", label: "PENDING" };
        return <StatusBadge status={config.status} label={config.label} />;
      },
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <RetailerLayout>
        <BackNavigation
          title="My Orders"
          onBack={() => navigate("/retailer")}
        />
        <div className="px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </RetailerLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <RetailerLayout>
        <BackNavigation
          title="My Orders"
          onBack={() => navigate("/retailer")}
        />
        <div className="px-4 md:px-6 py-12 text-center">
          <p className="text-destructive">Error loading orders: {error}</p>
        </div>
      </RetailerLayout>
    );
  }

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
            onRowClick={(order) => navigate(`/retailer/orders/${order.id}`)}
          />
        )}
      </div>
    </RetailerLayout>
  );
};
