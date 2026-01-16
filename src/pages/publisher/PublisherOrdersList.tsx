import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, Grid3X3, Search, Filter, Check } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, TabNavigation, DataTable, StatusBadge } from "@/components/neesh";

const mockOrders = [
  { id: "#0009", publisher: "Kinfolk", total: 450.00, time: "2h ago", date: "Dec 15, 2024", quantity: 15, shipping: "Standard", paymentStatus: "payment-received" as const, fulfillmentStatus: "received" as const },
  { id: "#0008", publisher: "Cereal", total: 280.00, time: "5h ago", date: "Dec 15, 2024", quantity: 10, shipping: "Express", paymentStatus: "payment-pending" as const, fulfillmentStatus: "pending" as const },
  { id: "#0007", publisher: "Apartamento", total: 320.00, time: "1d ago", date: "Dec 14, 2024", quantity: 12, shipping: "Standard", paymentStatus: "payment-received" as const, fulfillmentStatus: "unfulfilled" as const },
  { id: "#0006", publisher: "Kinfolk", total: 180.00, time: "2d ago", date: "Dec 13, 2024", quantity: 6, shipping: "Express", paymentStatus: "payment-received" as const, fulfillmentStatus: "received" as const },
  { id: "#0005", publisher: "Cereal", total: 560.00, time: "3d ago", date: "Dec 12, 2024", quantity: 20, shipping: "Standard", paymentStatus: "payment-pending" as const, fulfillmentStatus: "pending" as const },
  { id: "#0004", publisher: "Apartamento", total: 420.00, time: "4d ago", date: "Dec 11, 2024", quantity: 14, shipping: "Standard", paymentStatus: "payment-received" as const, fulfillmentStatus: "received" as const },
  { id: "#0003", publisher: "Kinfolk", total: 350.00, time: "5d ago", date: "Dec 10, 2024", quantity: 12, shipping: "Express", paymentStatus: "payment-received" as const, fulfillmentStatus: "received" as const },
  { id: "#0002", publisher: "Cereal", total: 290.00, time: "6d ago", date: "Dec 9, 2024", quantity: 10, shipping: "Standard", paymentStatus: "payment-pending" as const, fulfillmentStatus: "unfulfilled" as const },
];

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

  const handleCashOut = () => {
    navigate("/publisher/transfers/withdraw");
  };

  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedOrders(selectedIds);
  };

  const columns = [
    { key: "id", header: "Order" },
    { key: "publisher", header: "Publisher" },
    { key: "total", header: "Total", render: (value: number) => `$${value.toFixed(2)}` },
    { 
      key: "time", 
      header: "Time", 
      render: (value: string, row: any) => (
        <div>
          <span className="text-foreground">{value}</span>
          <span className="text-muted-foreground ml-1">· {row.date}</span>
        </div>
      )
    },
    { key: "quantity", header: "Quantity" },
    { key: "shipping", header: "Shipping" },
    { 
      key: "paymentStatus", 
      header: "Payment Status", 
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={value as any} />
          {value === "payment-received" && <Check className="w-4 h-4 text-chart-green" />}
        </div>
      )
    },
    { key: "fulfillmentStatus", header: "Fulfillment Status", render: (value: string) => <StatusBadge status={value as any} /> },
  ];

  const filteredOrders = mockOrders.filter(order => 
    order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.publisher.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PublisherLayout>
      <BackNavigation
        title="My Orders"
        onBack={() => navigate("/publisher")}
        rightContent={
          <WalletDisplay
            label="Balance"
            amount={2720.00}
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
          <DataTable
            columns={columns}
            data={filteredOrders}
            selectable
            selectedRows={selectedOrders}
            onSelectionChange={handleSelectionChange}
            onRowClick={(order) => navigate(`/publisher/orders/${order.id.replace("#", "")}`)}
          />
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherOrdersList;
