import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import { AdminLayout, StatCard, DateRangePicker } from "@/components/admin";
import { BackNavigation, TabNavigation, DataTable, StatusBadge, ButtonPrimary, ButtonSecondary, FormInput } from "@/components/neesh";

interface Order {
  id: string;
  retailer: string;
  publisher: string;
  total: number;
  orderDate: string;
  paymentStatus: 'payment-received' | 'payment-pending' | 'payment-sent';
  fulfillmentStatus: 'received' | 'pending' | 'unfulfilled' | 'returned';
  [key: string]: unknown;
}

const mockOrders: Order[] = [
  { id: "#0049", retailer: "Powell's Books", publisher: "Kinfolk Magazine", total: 450.00, orderDate: "Jan 16, 2026", paymentStatus: "payment-received", fulfillmentStatus: "pending" },
  { id: "#0048", retailer: "McNally Jackson", publisher: "Cereal Magazine", total: 280.00, orderDate: "Jan 15, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0047", retailer: "City Lights Books", publisher: "The Gourmand", total: 320.00, orderDate: "Jan 14, 2026", paymentStatus: "payment-pending", fulfillmentStatus: "pending" },
  { id: "#0046", retailer: "Skylight Books", publisher: "Apartamento", total: 180.00, orderDate: "Jan 13, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0045", retailer: "The Strand", publisher: "Drift Magazine", total: 560.00, orderDate: "Jan 12, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0044", retailer: "Rare Device", publisher: "MacGuffin Magazine", total: 145.00, orderDate: "Jan 11, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0043", retailer: "Assembly Coffee", publisher: "Monocle", total: 210.00, orderDate: "Jan 10, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0042", retailer: "Wolfman", publisher: "Kinfolk Magazine", total: 90.00, orderDate: "Jan 9, 2026", paymentStatus: "payment-pending", fulfillmentStatus: "unfulfilled" },
  { id: "#0041", retailer: "Amoeba Music", publisher: "Offscreen Magazine", total: 175.00, orderDate: "Jan 8, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0040", retailer: "Dusty Groove", publisher: "Cereal Magazine", total: 230.00, orderDate: "Jan 7, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0039", retailer: "Powell's Books", publisher: "Perdiz Magazine", total: 120.00, orderDate: "Jan 6, 2026", paymentStatus: "payment-received", fulfillmentStatus: "received" },
  { id: "#0038", retailer: "McNally Jackson", publisher: "Works That Work", total: 85.00, orderDate: "Jan 5, 2026", paymentStatus: "payment-received", fulfillmentStatus: "returned" },
];

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

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.retailer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.publisher.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "pending") return matchesSearch && order.fulfillmentStatus === "pending";
    if (activeTab === "fulfilled") return matchesSearch && order.fulfillmentStatus === "received";
    if (activeTab === "returned") return matchesSearch && order.fulfillmentStatus === "returned";
    return matchesSearch;
  });

  const totalOrders = mockOrders.length;
  const pendingFulfillment = mockOrders.filter(o => o.fulfillmentStatus === 'pending' || o.fulfillmentStatus === 'unfulfilled').length;
  const shippedThisWeek = mockOrders.filter(o => o.fulfillmentStatus === 'received').length;
  const revenueThisMonth = mockOrders.reduce((sum, o) => sum + o.total, 0);

  const columns = [
    { key: "id", header: "Order #", sortable: true },
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
      render: (_: unknown, row: Order) => (
        <ButtonSecondary 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/orders/${row.id.replace("#", "")}`);
          }}
          className="text-caption py-1 px-3"
        >
          View
        </ButtonSecondary>
      ),
    },
  ];

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
          <DataTable
            columns={columns}
            data={filteredOrders}
            selectable
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            onRowClick={(row) => navigate(`/admin/orders/${row.id.replace("#", "")}`)}
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
