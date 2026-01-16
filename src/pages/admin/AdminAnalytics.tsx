import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout, StatCard, DateRangePicker } from "@/components/admin";
import { BackNavigation, DataTable } from "@/components/neesh";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";

// Mock data
const revenueData = [
  { date: "Jan 1", revenue: 1200, orders: 12 },
  { date: "Jan 2", revenue: 1800, orders: 18 },
  { date: "Jan 3", revenue: 1400, orders: 14 },
  { date: "Jan 4", revenue: 2200, orders: 22 },
  { date: "Jan 5", revenue: 2800, orders: 28 },
  { date: "Jan 6", revenue: 2400, orders: 24 },
  { date: "Jan 7", revenue: 3200, orders: 32 },
  { date: "Jan 8", revenue: 2900, orders: 29 },
  { date: "Jan 9", revenue: 3100, orders: 31 },
  { date: "Jan 10", revenue: 2600, orders: 26 },
  { date: "Jan 11", revenue: 3400, orders: 34 },
  { date: "Jan 12", revenue: 3800, orders: 38 },
  { date: "Jan 13", revenue: 3200, orders: 32 },
  { date: "Jan 14", revenue: 4100, orders: 41 },
  { date: "Jan 15", revenue: 4500, orders: 45 },
  { date: "Jan 16", revenue: 4850, orders: 48 },
];

const topPublishers = [
  { id: "1", rank: 1, name: "Kinfolk Magazine", revenue: 12450.00, orders: 124, percentage: 25.6 },
  { id: "2", rank: 2, name: "Monocle", revenue: 9820.00, orders: 98, percentage: 20.2 },
  { id: "3", rank: 3, name: "Cereal Magazine", revenue: 7650.00, orders: 76, percentage: 15.7 },
  { id: "4", rank: 4, name: "The Gourmand", revenue: 5430.00, orders: 54, percentage: 11.2 },
  { id: "5", rank: 5, name: "Apartamento", revenue: 4120.00, orders: 41, percentage: 8.5 },
  { id: "6", rank: 6, name: "Drift Magazine", revenue: 3210.00, orders: 32, percentage: 6.6 },
  { id: "7", rank: 7, name: "MacGuffin Magazine", revenue: 2140.00, orders: 21, percentage: 4.4 },
  { id: "8", rank: 8, name: "Offscreen Magazine", revenue: 1680.00, orders: 17, percentage: 3.5 },
  { id: "9", rank: 9, name: "Perdiz Magazine", revenue: 1120.00, orders: 11, percentage: 2.3 },
  { id: "10", rank: 10, name: "Works That Work", revenue: 980.00, orders: 10, percentage: 2.0 },
];

const topMagazines = [
  { id: "1", rank: 1, title: "Kinfolk Issue 50", publisher: "Kinfolk Magazine", unitsSold: 342, revenue: 6156.00 },
  { id: "2", rank: 2, title: "Monocle Issue 178", publisher: "Monocle", unitsSold: 289, revenue: 5780.00 },
  { id: "3", rank: 3, title: "Cereal Vol. 22", publisher: "Cereal Magazine", unitsSold: 256, revenue: 4608.00 },
  { id: "4", rank: 4, title: "Kinfolk Issue 49", publisher: "Kinfolk Magazine", unitsSold: 234, revenue: 4212.00 },
  { id: "5", rank: 5, title: "The Gourmand Issue 18", publisher: "The Gourmand", unitsSold: 198, revenue: 3564.00 },
  { id: "6", rank: 6, title: "Apartamento Issue 31", publisher: "Apartamento", unitsSold: 176, revenue: 3168.00 },
  { id: "7", rank: 7, title: "Drift Vol. 15", publisher: "Drift Magazine", unitsSold: 154, revenue: 2772.00 },
  { id: "8", rank: 8, title: "Monocle Issue 177", publisher: "Monocle", unitsSold: 143, revenue: 2860.00 },
  { id: "9", rank: 9, title: "MacGuffin Issue 10", publisher: "MacGuffin Magazine", unitsSold: 121, revenue: 2178.00 },
  { id: "10", rank: 10, title: "Cereal Vol. 21", publisher: "Cereal Magazine", unitsSold: 108, revenue: 1944.00 },
];

const geographicData = [
  { id: "1", region: "California", orders: 156, revenue: 14580.00, percentage: 22.4 },
  { id: "2", region: "New York", orders: 142, revenue: 13420.00, percentage: 20.6 },
  { id: "3", region: "Oregon", orders: 98, revenue: 9120.00, percentage: 14.0 },
  { id: "4", region: "Illinois", orders: 67, revenue: 6230.00, percentage: 9.6 },
  { id: "5", region: "Washington", orders: 54, revenue: 5040.00, percentage: 7.7 },
  { id: "6", region: "Texas", orders: 45, revenue: 4180.00, percentage: 6.4 },
  { id: "7", region: "Massachusetts", orders: 38, revenue: 3520.00, percentage: 5.4 },
  { id: "8", region: "Colorado", orders: 32, revenue: 2980.00, percentage: 4.6 },
  { id: "9", region: "Other", orders: 63, revenue: 5930.00, percentage: 9.3 },
];

const storeTypeData = [
  { type: "Independent Bookstore", orders: 312, percentage: 45 },
  { type: "Boutique", orders: 142, percentage: 20 },
  { type: "Coffee Shop", orders: 98, percentage: 14 },
  { type: "Record Store", orders: 76, percentage: 11 },
  { type: "Museum Shop", orders: 45, percentage: 7 },
  { type: "Other", orders: 22, percentage: 3 },
];

export const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const grossRevenue = 48600;
  const neeshCommission = grossRevenue * 0.1;
  const totalOrders = 486;
  const avgOrderValue = grossRevenue / totalOrders;

  const publisherColumns = [
    { key: "rank", header: "#", align: "center" as const },
    { key: "name", header: "Publisher" },
    { key: "revenue", header: "Revenue", align: "right" as const, render: (v: unknown) => `$${(v as number).toLocaleString()}` },
    { key: "orders", header: "Orders", align: "center" as const },
    { key: "percentage", header: "% of Total", align: "right" as const, render: (v: unknown) => `${v}%` },
  ];

  const magazineColumns = [
    { key: "rank", header: "#", align: "center" as const },
    { key: "title", header: "Magazine" },
    { key: "publisher", header: "Publisher" },
    { key: "unitsSold", header: "Units", align: "center" as const },
    { key: "revenue", header: "Revenue", align: "right" as const, render: (v: unknown) => `$${(v as number).toLocaleString()}` },
  ];

  const geoColumns = [
    { key: "region", header: "Region" },
    { key: "orders", header: "Orders", align: "center" as const },
    { key: "revenue", header: "Revenue", align: "right" as const, render: (v: unknown) => `$${(v as number).toLocaleString()}` },
    { key: "percentage", header: "% of Total", align: "right" as const, render: (v: unknown) => `${v}%` },
  ];

  return (
    <AdminLayout>
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <BackNavigation title="Analytics" onBack={() => navigate("/admin")} />
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={(start, end) => setDateRange({ start, end })}
          />
        </div>
      </div>

      {/* Top Metrics */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Gross Revenue"
            value={`$${grossRevenue.toLocaleString()}`}
            trend={{ value: 12.5, direction: 'up' }}
          />
          <StatCard
            label="Neesh Commission"
            value={`$${neeshCommission.toLocaleString()}`}
            subtitle="10% of revenue"
            highlight="success"
          />
          <StatCard
            label="Total Orders"
            value={totalOrders}
            trend={{ value: 8.2, direction: 'up' }}
          />
          <StatCard
            label="Avg Order Value"
            value={`$${avgOrderValue.toFixed(2)}`}
            trend={{ value: 3.1, direction: 'up' }}
          />
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="px-4 md:px-6 pb-6">
        <div className="card-neesh">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-heading text-foreground">Revenue Over Time</h3>
            <div className="flex gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setChartView(view)}
                  className={`px-3 py-1 rounded text-caption font-medium capitalize ${
                    chartView === view
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-caption" />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  className="text-caption"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--chart-purple))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Publishers & Magazines */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Top Publishers</h3>
            <DataTable
              columns={publisherColumns}
              data={topPublishers as unknown as Record<string, unknown>[]}
            />
          </div>
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Top Magazines</h3>
            <DataTable
              columns={magazineColumns}
              data={topMagazines as unknown as Record<string, unknown>[]}
            />
          </div>
        </div>
      </div>

      {/* Geographic & Store Type */}
      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Geographic Distribution</h3>
            <DataTable
              columns={geoColumns}
              data={geographicData as unknown as Record<string, unknown>[]}
            />
          </div>
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Orders by Store Type</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storeTypeData} layout="vertical">
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis 
                    type="category" 
                    dataKey="type" 
                    axisLine={false} 
                    tickLine={false}
                    width={120}
                    className="text-caption"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                    formatter={(value: number) => [value, "Orders"]}
                  />
                  <Bar 
                    dataKey="orders" 
                    fill="hsl(var(--chart-purple))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
