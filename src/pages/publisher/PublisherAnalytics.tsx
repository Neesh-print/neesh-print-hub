import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart, AlertTriangle } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, ButtonSecondary, EmptyState } from "@/components/neesh";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock data - would come from API in production
const mockMetrics = {
  revenue: 4280.00,
  revenueTrend: 12,
  orders: 47,
  ordersTrend: 8,
  unitsSold: 284,
  titlesCount: 6,
  avgOrderValue: 91.06,
  avgOrderTrend: 4.20
};

const mockRevenueData = [
  { date: 'Jan 1', revenue: 320 },
  { date: 'Jan 5', revenue: 450 },
  { date: 'Jan 10', revenue: 380 },
  { date: 'Jan 15', revenue: 520 },
  { date: 'Jan 20', revenue: 680 },
  { date: 'Jan 25', revenue: 590 },
  { date: 'Jan 30', revenue: 740 },
  { date: 'Feb 4', revenue: 600 },
];

const mockOrdersByStatus = [
  { name: 'Pending', value: 8, color: 'hsl(var(--status-pending-text))' },
  { name: 'Confirmed', value: 12, color: 'hsl(var(--chart-purple))' },
  { name: 'Shipped', value: 15, color: 'hsl(var(--accent))' },
  { name: 'Delivered', value: 12, color: 'hsl(var(--chart-green))' },
];

const mockTopTitles = [
  { id: '1', title: 'Issue 45 - Summer Edition', cover: '/placeholder.svg', units: 84, revenue: 2352 },
  { id: '2', title: 'Issue 44 - Spring Collection', cover: '/placeholder.svg', units: 67, revenue: 1876 },
  { id: '3', title: 'Issue 43 - Winter Special', cover: '/placeholder.svg', units: 52, revenue: 1456 },
  { id: '4', title: 'Issue 42 - Fall Favorites', cover: '/placeholder.svg', units: 45, revenue: 1260 },
  { id: '5', title: 'Issue 41 - Anniversary', cover: '/placeholder.svg', units: 36, revenue: 1008 },
];

const mockRevenueByTitle = [
  { title: 'Issue 45', revenue: 2352 },
  { title: 'Issue 44', revenue: 1876 },
  { title: 'Issue 43', revenue: 1456 },
  { title: 'Issue 42', revenue: 1260 },
  { title: 'Issue 41', revenue: 1008 },
  { title: 'Issue 40', revenue: 820 },
];

const mockTopRetailers = [
  { id: '1', name: 'Brooklyn Books', location: 'Brooklyn, NY', orders: 12, spent: 1089 },
  { id: '2', name: 'The Corner Bookshop', location: 'Portland, OR', orders: 9, spent: 856 },
  { id: '3', name: 'Indie Press Shop', location: 'Los Angeles, CA', orders: 8, spent: 742 },
  { id: '4', name: 'Modern Reader', location: 'Austin, TX', orders: 6, spent: 534 },
  { id: '5', name: 'Paper & Ink', location: 'Seattle, WA', orders: 5, spent: 489 },
];

const mockGeographicData = [
  { region: 'California', orders: 23, percentage: 34 },
  { region: 'New York', orders: 18, percentage: 26 },
  { region: 'Oregon', orders: 12, percentage: 17 },
  { region: 'Texas', orders: 8, percentage: 12 },
  { region: 'Other', orders: 8, percentage: 11 },
];

const mockInventoryAlerts = [
  { id: '1', title: 'Issue 45 - Summer Edition', stock: 12, threshold: 20 },
  { id: '2', title: 'Issue 43 - Winter Special', stock: 8, threshold: 15 },
];

const dateRangeOptions = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

interface MetricCardProps {
  title: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
}

const MetricCard = ({ title, value, trend, trendLabel, icon }: MetricCardProps) => {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div className="card-neesh">
      <div className="flex items-start justify-between mb-2">
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-caption text-muted-foreground mb-1">{title}</p>
      <p className="font-display font-bold text-2xl text-foreground">{value}</p>
      {(trend !== undefined || trendLabel) && (
        <div className="flex items-center gap-1 mt-2">
          {trend !== undefined && (
            <>
              {isPositive && <TrendingUp className="w-4 h-4 text-chart-green" />}
              {isNegative && <TrendingDown className="w-4 h-4 text-destructive" />}
              <span className={`text-caption font-medium ${isPositive ? 'text-chart-green' : isNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
                {isPositive ? '+' : ''}{trend}%
              </span>
            </>
          )}
          {trendLabel && (
            <span className="text-caption text-muted-foreground">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
};

export const PublisherAnalytics = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('30d');

  const maxUnits = Math.max(...mockTopTitles.map(t => t.units));

  const handleExport = (format: 'csv' | 'pdf') => {
    // TODO: Implement export functionality
    console.log(`Exporting as ${format}`);
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title="Analytics"
        onBack={() => navigate("/publisher")}
        rightContent={
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ButtonSecondary>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </ButtonSecondary>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-6">
        {/* Top Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Revenue"
            value={`$${mockMetrics.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            trend={mockMetrics.revenueTrend}
            trendLabel="vs previous period"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            title="Orders"
            value={mockMetrics.orders.toString()}
            trend={mockMetrics.ordersTrend}
            trendLabel="vs previous period"
            icon={<ShoppingCart className="w-5 h-5" />}
          />
          <MetricCard
            title="Units Sold"
            value={mockMetrics.unitsSold.toString()}
            trendLabel={`Across ${mockMetrics.titlesCount} titles`}
            icon={<Package className="w-5 h-5" />}
          />
          <MetricCard
            title="Avg Order Value"
            value={`$${mockMetrics.avgOrderValue.toFixed(2)}`}
            trend={Math.round((mockMetrics.avgOrderTrend / (mockMetrics.avgOrderValue - mockMetrics.avgOrderTrend)) * 100)}
            trendLabel="vs previous period"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Revenue Chart */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Revenue Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockRevenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-purple))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-purple))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  className="text-caption"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--chart-purple))"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Status & Best Sellers */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Orders by Status */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Order Status Breakdown</h3>
            <div className="flex items-center gap-8">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockOrdersByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {mockOrdersByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px"
                      }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {mockOrdersByStatus.map((status) => (
                  <div key={status.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-body text-foreground">{status.name}</span>
                    </div>
                    <span className="text-body font-medium text-foreground">
                      {status.value} orders
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Best Sellers */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Best Sellers</h3>
            <div className="space-y-3">
              {mockTopTitles.map((title, index) => (
                <div 
                  key={title.id} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => navigate(`/publisher/titles/${title.id}/edit`)}
                >
                  <span className="w-6 text-center font-display font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <img
                    src={title.cover}
                    alt={title.title}
                    className="w-10 h-14 object-cover rounded bg-secondary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-medium text-foreground truncate">{title.title}</p>
                    <div className="flex items-center gap-4 text-caption text-muted-foreground">
                      <span>{title.units} units</span>
                      <span>${title.revenue.toLocaleString()}</span>
                    </div>
                    {/* Performance bar */}
                    <div className="mt-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-chart-purple rounded-full transition-all"
                        style={{ width: `${(title.units / maxUnits) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue by Title */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Revenue by Title</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockRevenueByTitle} layout="vertical">
                <XAxis 
                  type="number" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <YAxis 
                  type="category" 
                  dataKey="title" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  width={80}
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
                <Bar 
                  dataKey="revenue" 
                  fill="hsl(var(--chart-purple))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Retailer Insights */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Retailers */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Top Retailers</h3>
            <div className="space-y-3">
              {mockTopRetailers.map((retailer) => (
                <div key={retailer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary transition-colors">
                  <div>
                    <p className="text-body font-medium text-foreground">{retailer.name}</p>
                    <p className="text-caption text-muted-foreground">{retailer.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-medium text-foreground">${retailer.spent.toLocaleString()}</p>
                    <p className="text-caption text-muted-foreground">{retailer.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
            {/* TODO: Link to full retailer insights page */}
            <button className="mt-4 text-caption text-accent hover:underline">
              View all retailers →
            </button>
          </div>

          {/* Geographic Distribution */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Geographic Distribution</h3>
            <div className="space-y-3">
              {mockGeographicData.map((region) => (
                <div key={region.region} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-body text-foreground">{region.region}</span>
                    <span className="text-caption text-muted-foreground">
                      {region.orders} orders ({region.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-chart-purple rounded-full transition-all"
                      style={{ width: `${region.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory Alerts */}
        {mockInventoryAlerts.length > 0 && (
          <div className="card-neesh border-status-pending">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-status-pending-text" />
              <h3 className="font-display font-semibold text-heading text-foreground">Inventory Alerts</h3>
            </div>
            <p className="text-body text-muted-foreground mb-4">
              {mockInventoryAlerts.length} title{mockInventoryAlerts.length > 1 ? 's' : ''} running low on inventory
            </p>
            <div className="space-y-2">
              {mockInventoryAlerts.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => navigate(`/publisher/titles/${item.id}/edit`)}
                >
                  <span className="text-body text-foreground">{item.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-caption text-muted-foreground">{item.stock} in stock</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-status-pending text-status-pending-text">
                      Low stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => navigate('/publisher/titles')}
              className="mt-4 text-caption text-accent hover:underline"
            >
              Manage inventory →
            </button>
          </div>
        )}
      </div>
    </PublisherLayout>
  );
};

export default PublisherAnalytics;
