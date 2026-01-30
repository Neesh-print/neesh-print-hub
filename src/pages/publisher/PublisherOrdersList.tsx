import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, Grid3X3, Search, Filter, Check, AlertCircle, Package } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, TabNavigation, DataTable, StatusBadge, EmptyState, ButtonPrimary } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { Order, useOrders } from "@/hooks/useOrders";

const tabs = [
  { id: "orders", label: "My Orders" },
  { id: "returns", label: "My Returns" },
];

export const PublisherOrdersList = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  
  const { publisher, isLoading: publisherLoading } = usePublisherProfile();
  const { orders, isLoading: ordersLoading, error, refetch } = useOrders({
    publisherId: publisher?.id,
  });

  const isLoading = publisherLoading || (publisher && ordersLoading);

  const handleCashOut = () => {
    navigate("/publisher/transfers/withdraw");
  };

  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedOrders(selectedIds);
  };

  const columns = [
    { key: "order_number", header: "Order" },
    { 
      key: "magazine", 
      header: "Title", 
      render: (value: Order['magazine']) => value?.title || "Unknown" 
    },
    {
      key: "retailer",
      header: "Retailer",
      render: (value: Order['retailer']) => value?.shop_name || "Unknown Retailer"
    },
    { key: "total_amount", header: "Total", render: (value: number) => `$${value.toFixed(2)}` },
    {
      key: "created_at",
      header: "Time",
      render: (value: string) => {
        const date = new Date(value);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeAgo = diffHours < 24 ? `${diffHours}h ago` : `${diffDays}d ago`;
        return (
          <div>
            <span className="text-foreground">{timeAgo}</span>
            <span className="text-muted-foreground ml-1">· {formattedDate}</span>
          </div>
        );
      }
    },
    { key: "quantity", header: "Quantity" },
    { 
      key: "payment_status", 
      header: "Payment Status", 
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={value as 'pending' | 'received' | 'payment-pending' | 'payment-received'} />
          {value === "paid" && <Check className="w-4 h-4 text-chart-green" />}
        </div>
      )
    },
    { 
      key: "fulfillment_status", 
      header: "Fulfillment Status", 
      render: (value: string) => <StatusBadge status={value as 'pending' | 'shipped' | 'delivered' | 'cancelled'} /> 
    },
  ];

  const filteredOrders = orders.filter(order => 
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (order.magazine?.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <PublisherLayout>
        <LoadingScreen message="Loading orders..." />
      </PublisherLayout>
    );
  }

  if (error) {
    return (
      <PublisherLayout>
        <div className="p-6">
          <EmptyState
            icon={<AlertCircle className="w-12 h-12 text-destructive" />}
            title="Something went wrong"
            description={error}
            action={<ButtonPrimary onClick={refetch}>Try Again</ButtonPrimary>}
          />
        </div>
      </PublisherLayout>
    );
  }

  return (
    <PublisherLayout>
      <BackNavigation
        title="My Orders"
        onBack={() => navigate("/publisher")}
        rightContent={
          <WalletDisplay
            label="Balance"
            amount={publisher?.total_sales || 0}
            actionLabel="Cash Out"
            onAction={handleCashOut}
          />
        }
      />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Controls Row */}
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-secondary" : "hover:bg-secondary"}`}
          >
            <List className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-secondary" : "hover:bg-secondary"}`}
          >
            <Grid3X3 className="w-4 h-4 text-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-neesh w-full pl-10"
            />
          </div>
        </div>

        <button className="p-2 rounded hover:bg-secondary transition-colors">
          <Filter className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Orders Table */}
      <div className="px-4 md:px-6 pb-8">
        <div className="card-neesh overflow-x-auto">
          {filteredOrders.length === 0 ? (
              <EmptyState
                icon={<Package className="w-12 h-12 text-muted-foreground" />}
                title={searchQuery ? "No orders found" : "No orders yet"}
                description={searchQuery ? "Try adjusting your search" : "When retailers purchase your titles, orders will appear here"}
              />
          ) : (
            <DataTable
              columns={columns}
              data={filteredOrders}
              selectable
              selectedRows={selectedOrders}
              onSelectionChange={handleSelectionChange}
              onRowClick={(order) => navigate(`/publisher/orders/${order.id}`)}
            />
          )}
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherOrdersList;
