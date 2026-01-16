import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, ProgressBar, DataTable, StatusBadge } from "@/components/neesh";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

// Mock data
const salesChartData = [
  { month: "Jan", sales: 1200 },
  { month: "Feb", sales: 1800 },
  { month: "Mar", sales: 1400 },
  { month: "Apr", sales: 2200 },
  { month: "May", sales: 2800 },
  { month: "Jun", sales: 3200 },
];

const mockTitles = [
  { id: "1", title: "Kinfolk Magazine", coverImage: "/placeholder.svg", inventory: 45, total: 100 },
  { id: "2", title: "Cereal Magazine", coverImage: "/placeholder.svg", inventory: 23, total: 50 },
  { id: "3", title: "Apartamento", coverImage: "/placeholder.svg", inventory: 67, total: 80 },
];

const mockOrders = [
  { id: "#0009", publisher: "Kinfolk", total: 450.00, time: "2h ago", volume: 15, type: "Wholesale", status: "received" as const },
  { id: "#0008", publisher: "Cereal", total: 280.00, time: "5h ago", volume: 10, type: "Wholesale", status: "pending" as const },
  { id: "#0007", publisher: "Apartamento", total: 320.00, time: "1d ago", volume: 12, type: "Consignment", status: "unfulfilled" as const },
  { id: "#0006", publisher: "Kinfolk", total: 180.00, time: "2d ago", volume: 6, type: "Wholesale", status: "received" as const },
  { id: "#0005", publisher: "Cereal", total: 560.00, time: "3d ago", volume: 20, type: "Wholesale", status: "received" as const },
];

const timePeriods = ["D", "W", "M", "Q", "YTD", "Y", "ALL"];

export const PublisherDashboard = () => {
  const navigate = useNavigate();
  const [activePeriod, setActivePeriod] = useState("M");
  const [titlesExpanded, setTitlesExpanded] = useState(true);

  const handleTransfer = () => {
    navigate("/publisher/transfers");
  };

  const orderColumns = [
    { key: "id", header: "Order" },
    { key: "publisher", header: "Publisher" },
    { key: "total", header: "Total", render: (value: number) => `$${value.toFixed(2)}` },
    { key: "time", header: "Time" },
    { key: "volume", header: "Volume" },
    { key: "type", header: "Type" },
    { key: "status", header: "Fulfillment", render: (value: string) => <StatusBadge status={value as any} /> },
  ];

  return (
    <PublisherLayout>
      <BackNavigation
        title="Overview"
        onBack={() => navigate("/")}
        rightContent={
          <WalletDisplay
            label="Account Balance"
            amount={2720.00}
            actionLabel="Transfer"
            onAction={handleTransfer}
          />
        }
      />

      {/* Hero Metrics Section */}
      <div className="px-4 md:px-6 pb-6">
        <div className="card-neesh">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Total Sales Card */}
            <div className="lg:w-1/3">
              <p className="text-caption text-muted-foreground mb-1">Total Sales</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display font-bold text-display-md text-foreground">$3,200.90</span>
                <div className="flex items-center gap-1 text-chart-green">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-body font-medium">+12.30%</span>
                </div>
              </div>
              <p className="text-caption text-muted-foreground mt-2">1,000/2,000 Sold</p>
            </div>

            {/* Sales Chart */}
            <div className="lg:w-2/3">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesChartData}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-caption" />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px"
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Sales"]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="hsl(var(--chart-purple))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Time Period Toggles */}
              <div className="flex gap-2 mt-4">
                {timePeriods.map((period) => (
                  <button
                    key={period}
                    onClick={() => setActivePeriod(period)}
                    className={`px-3 py-1.5 rounded text-caption font-medium transition-colors ${
                      activePeriod === period
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Titles */}
          <div className="card-neesh">
            <button
              onClick={() => setTitlesExpanded(!titlesExpanded)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h3 className="font-display font-semibold text-heading text-foreground">My Titles</h3>
              {titlesExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {titlesExpanded && (
              <div className="space-y-4">
                {mockTitles.map((title) => (
                  <div
                    key={title.id}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                    onClick={() => navigate(`/publisher/titles/${title.id}/edit`)}
                  >
                    <img
                      src={title.coverImage}
                      alt={title.title}
                      className="w-12 h-16 object-cover rounded bg-secondary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-medium text-body text-foreground truncate">
                        {title.title}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {title.inventory} in stock
                      </p>
                      <div className="mt-2">
                        <ProgressBar current={title.inventory} total={title.total} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Orders */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Latest Orders</h3>
            <DataTable
              columns={orderColumns}
              data={mockOrders}
              onRowClick={(order) => navigate(`/publisher/orders/${order.id.replace("#", "")}`)}
            />
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherDashboard;
