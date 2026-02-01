import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart, AlertTriangle, BarChart as BarChartIcon } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, ButtonSecondary, EmptyState } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
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
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { usePublisherAnalytics } from "@/hooks/usePublisherAnalytics";
import { useMagazines } from "@/hooks/useMagazines";

const dateRangeOptions = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  // { value: 'year', label: 'This year' }, // Not implemented yet in hook
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
  
  const { publisher, isLoading: profileLoading } = usePublisherProfile();
  
  const daysToCheck = dateRange === '90d' ? 90 : 30;
  const { metrics, isLoading: analyticsLoading } = usePublisherAnalytics(publisher?.id, daysToCheck);
  
  const { magazines } = useMagazines({ publisherId: publisher?.id });

  const handleExport = (format: 'csv' | 'pdf') => {
    // TODO: Implement export functionality
    console.log(`Exporting as ${format}`);
  };

  if (profileLoading || analyticsLoading) {
      return (
          <PublisherLayout>
              <LoadingScreen message="Loading analytics..." />
          </PublisherLayout>
      );
  }

  // --- Derived Data for UI ---
  const { revenueByDate, topTitles, ordersByStatus } = metrics;
  const hasRevenue = metrics.totalRevenue > 0;
  const maxUnits = Math.max(...topTitles.map(t => t.units), 1);

  // Inventory logic could move to hook, but simple enough here
  // Threshold: 10?
  const inventoryAlerts = magazines.filter(m => (m.inventory_count || 0) < 10 && m.is_active);

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
                <DropdownMenuItem onClick={() => handleExport('csv')} disabled>
                  Export CSV (Coming Soon)
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
            value={`$${metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            trendLabel="in selected period"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            title="Orders"
            value={metrics.totalOrders.toString()}
            trendLabel="in selected period"
            icon={<ShoppingCart className="w-5 h-5" />}
          />
          <MetricCard
            title="Units Sold"
            value={metrics.totalUnitsSold.toString()}
            trendLabel={`Across ${magazines.length} active titles`}
            icon={<Package className="w-5 h-5" />}
          />
          <MetricCard
            title="Avg Order Value"
            value={`$${metrics.averageOrderValue.toFixed(2)}`}
            trendLabel="per order"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Revenue Chart */}
        <div className="card-neesh">
          <h3 className="font-display font-semibold text-heading text-foreground mb-4">Revenue Over Time</h3>
          <div className="h-64 relative">
             {!hasRevenue && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[1px] z-10 rounded-lg border border-dashed border-border text-center p-4">
                    <BarChartIcon className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-body font-medium text-muted-foreground">No revenue data</p>
                    <p className="text-caption text-muted-foreground">Chart will update when sales occur.</p>
                </div>
             )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByDate}>
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
                  minTickGap={30}
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
            {ordersByStatus.length === 0 ? (
                <EmptyState
                    icon={<ShoppingCart className="w-8 h-8 text-muted-foreground" />}
                    title="No orders"
                    description="No order data available for this period"
                />
            ) : (
                <div className="flex items-center gap-8">
                <div className="w-40 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={ordersByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        >
                        {ordersByStatus.map((entry, index) => (
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
                    {ordersByStatus.map((status) => (
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
            )}
          </div>

          {/* Best Sellers */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Best Sellers</h3>
            {topTitles.length === 0 ? (
                <EmptyState
                    icon={<Package className="w-8 h-8 text-muted-foreground" />}
                    title="No sales yet"
                    description="Your best selling titles will appear here"
                />
            ) : (
                <div className="space-y-3">
                {topTitles.map((title, index) => (
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
            )}
          </div>
        </div>

        {/* Revenue by Title - Optional / Deprecated if Best Sellers is sufficient, 
             but we can reuse Top Titles here for a chart */}
        {topTitles.length > 0 && (
            <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Revenue by Title</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTitles.slice(0, 10)} layout="vertical">
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
                    width={120}
                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
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
        )}

        {/* Inventory Alerts */}
        {inventoryAlerts.length > 0 && (
          <div className="card-neesh border-status-pending">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-status-pending-text" />
              <h3 className="font-display font-semibold text-heading text-foreground">Inventory Alerts</h3>
            </div>
            <p className="text-body text-muted-foreground mb-4">
              {inventoryAlerts.length} title{inventoryAlerts.length > 1 ? 's' : ''} running low on inventory
            </p>
            <div className="space-y-2">
              {inventoryAlerts.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => navigate(`/publisher/titles/${item.id}/edit`)}
                >
                  <span className="text-body text-foreground">{item.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-caption text-muted-foreground">{item.inventory_count} in stock</span>
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
