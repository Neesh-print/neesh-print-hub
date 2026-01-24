import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Store,
  ShoppingBag,
  Truck,
  Package,
  CheckCircle,
  AlertCircle,
  Bell
} from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { DataTable, StatusBadge, ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { useApplications } from "@/hooks/useApplications";
import { useOrders } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";

const chartConfig = {
  orders: {
    label: "Orders",
    color: "hsl(var(--accent))",
  },
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-green))",
  },
};

// Format relative time
const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, "MMM d");
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { applications } = useApplications();
  const [publisherCount, setPublisherCount] = useState(0);
  const [retailerCount, setRetailerCount] = useState(0);

  // Fetch this week's orders
  const weekAgo = useMemo(() => subDays(new Date(), 7), []);
  const { orders } = useOrders({ dateRange: { start: weekAgo, end: new Date() } });

  // Fetch publisher and retailer counts
  useEffect(() => {
    const fetchCounts = async () => {
      const { count: pubCount } = await supabase
        .from('publishers')
        .select('*', { count: 'exact', head: true })
        .eq('verified', true);
      setPublisherCount(pubCount || 0);

      const { count: retCount } = await supabase
        .from('retailers')
        .select('*', { count: 'exact', head: true })
        .eq('verified', true);
      setRetailerCount(retCount || 0);
    };
    fetchCounts();
  }, []);

  // Calculate stats from real data
  const stats = useMemo(() => {
    const pendingApps = applications.filter(a => a.status === 'pending').length;
    const ordersThisWeek = orders.length;
    const revenueThisWeek = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const fulfillmentQueue = orders.filter(o => o.fulfillment_status === 'pending').length;

    return {
      pendingApps,
      ordersThisWeek,
      revenueThisWeek,
      activePublishers: publisherCount,
      activeRetailers: retailerCount,
      fulfillmentQueue,
    };
  }, [applications, orders, publisherCount, retailerCount]);

  // Chart data from real orders
  const ordersChartData = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const data = dayNames.map(day => ({ day, orders: 0, revenue: 0 }));

    orders.forEach(order => {
      const dayIndex = new Date(order.created_at).getDay();
      data[dayIndex].orders += 1;
      data[dayIndex].revenue += order.total_amount;
    });

    // Reorder to start from Monday
    return [...data.slice(1), data[0]];
  }, [orders]);

  // Recent applications from real data
  const recentApplications = useMemo(() => {
    return applications.slice(0, 5).map(app => ({
      id: app.id,
      name: app.name,
      type: app.type === 'publisher' ? 'Publisher' : 'Retailer',
      email: app.email,
      status: app.status === 'approved' ? 'received' as const : app.status === 'rejected' ? 'unfulfilled' as const : 'pending' as const,
      submitted: formatRelativeTime(new Date(app.submitted_at)),
      originalType: app.type,
    }));
  }, [applications]);

  // Recent orders for the table
  const recentOrders = useMemo(() => {
    return orders.slice(0, 5).map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      retailer: order.retailer?.shop_name || 'Unknown',
      publisher: order.magazine?.title || 'Unknown',
      amount: order.total_amount,
      status: order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered'
        ? 'received' as const
        : order.fulfillment_status === 'pending'
          ? 'pending' as const
          : 'unfulfilled' as const,
    }));
  }, [orders]);

  // Activity feed derived from real data
  const activityFeed = useMemo(() => {
    const items: { id: string; icon: any; description: string; timestamp: Date; link: string; type: string }[] = [];

    // Add recent applications
    applications.slice(0, 4).forEach(app => {
      if (app.status === 'pending') {
        items.push({
          id: `app-${app.id}`,
          icon: app.type === 'publisher' ? FileText : Store,
          description: `New ${app.type} application: ${app.name}`,
          timestamp: new Date(app.submitted_at),
          link: `/admin/applications/${app.id}`,
          type: 'new_application',
        });
      } else if (app.status === 'approved') {
        items.push({
          id: `app-approved-${app.id}`,
          icon: CheckCircle,
          description: `Approved ${app.type}: ${app.name}`,
          timestamp: new Date(app.reviewed_at || app.submitted_at),
          link: `/admin/applications/${app.id}`,
          type: 'application_approved',
        });
      }
    });

    // Add recent orders
    orders.slice(0, 4).forEach(order => {
      if (order.fulfillment_status === 'shipped') {
        items.push({
          id: `order-shipped-${order.id}`,
          icon: Truck,
          description: `Order ${order.order_number} marked as shipped`,
          timestamp: new Date(order.created_at),
          link: `/admin/orders/${order.id}`,
          type: 'order_shipped',
        });
      } else {
        items.push({
          id: `order-${order.id}`,
          icon: ShoppingBag,
          description: `New order ${order.order_number} from ${order.retailer?.shop_name || 'a retailer'}`,
          timestamp: new Date(order.created_at),
          link: `/admin/orders/${order.id}`,
          type: 'new_order',
        });
      }
    });

    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);
  }, [applications, orders]);

  // Needs attention items
  const needsAttention = useMemo(() => {
    const items = [];

    if (stats.pendingApps > 0) {
      items.push({
        id: 'apps',
        icon: FileText,
        title: `${stats.pendingApps} application${stats.pendingApps !== 1 ? 's' : ''} pending review`,
        description: 'New publishers and retailers are waiting for approval',
        action: 'Review Now',
        link: '/admin/applications?status=pending',
        priority: 1,
      });
    }

    if (stats.fulfillmentQueue > 0) {
      items.push({
        id: 'fulfillment',
        icon: Package,
        title: `${stats.fulfillmentQueue} order${stats.fulfillmentQueue !== 1 ? 's' : ''} ready for fulfillment`,
        description: 'Orders are packed and waiting to ship',
        action: 'View Queue',
        link: '/admin/fulfillment',
        priority: 2,
      });
    }

    return items.sort((a, b) => a.priority - b.priority);
  }, [stats]);

  const orderColumns = [
    { key: "orderNumber", header: "Order #" },
    { key: "retailer", header: "Retailer" },
    { key: "publisher", header: "Publisher" },
    { key: "amount", header: "Amount", render: (value: unknown) => `$${(value as number).toFixed(2)}` },
    { key: "status", header: "Status", render: (value: unknown) => <StatusBadge status={value as 'pending' | 'received' | 'unfulfilled'} /> },
  ];

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="px-4 md:px-6 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-display-sm text-foreground">Dashboard</h1>
            <p className="text-body text-muted-foreground">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <ButtonSecondary
              onClick={() => navigate("/admin/applications")}
              className="gap-2"
            >
              Review Applications
              {stats.pendingApps > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs h-5 min-w-[20px] px-1.5">
                  {stats.pendingApps}
                </Badge>
              )}
            </ButtonSecondary>
            <ButtonPrimary
              onClick={() => navigate("/admin/fulfillment")}
              className="gap-2"
            >
              Process Fulfillment
              {stats.fulfillmentQueue > 0 && (
                <Badge className="ml-1 text-xs h-5 min-w-[20px] px-1.5 bg-white/20">
                  {stats.fulfillmentQueue}
                </Badge>
              )}
            </ButtonPrimary>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Pending Applications"
            value={stats.pendingApps}
            highlight={stats.pendingApps > 0 ? 'warning' : 'default'}
            onClick={() => navigate("/admin/applications?status=pending")}
          />
          <StatCard
            label="Orders This Week"
            value={stats.ordersThisWeek}
            onClick={() => navigate("/admin/orders")}
          />
          <StatCard
            label="Revenue This Week"
            value={`$${stats.revenueThisWeek.toLocaleString()}`}
            onClick={() => navigate("/admin/analytics")}
          />
          <StatCard
            label="Active Publishers"
            value={stats.activePublishers}
            onClick={() => navigate("/admin/publishers")}
          />
          <StatCard
            label="Active Retailers"
            value={stats.activeRetailers}
            onClick={() => navigate("/admin/retailers")}
          />
          <StatCard
            label="Fulfillment Queue"
            value={stats.fulfillmentQueue}
            highlight={stats.fulfillmentQueue > 0 ? 'warning' : 'success'}
            onClick={() => navigate("/admin/fulfillment")}
          />
        </div>
      </div>

      {/* Needs Attention Section */}
      <div className="px-4 md:px-6 pb-6">
        {needsAttention.length > 0 ? (
          <div className="space-y-3">
            {needsAttention.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-status-pending bg-status-pending/5"
              >
                <div className="w-10 h-10 rounded-full bg-status-pending/20 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-status-pending-text" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-body text-foreground">{item.title}</p>
                  <p className="text-caption text-muted-foreground">{item.description}</p>
                </div>
                <ButtonSecondary
                  onClick={() => navigate(item.link)}
                  className="flex-shrink-0"
                >
                  {item.action}
                </ButtonSecondary>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 rounded-lg border border-status-success bg-status-success/5">
            <div className="w-10 h-10 rounded-full bg-status-success/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-status-success" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-body text-foreground">All caught up!</p>
              <p className="text-caption text-muted-foreground">No urgent items requiring attention</p>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Orders Chart */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-body text-foreground mb-4">Orders This Week</h3>
            {orders.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[160px] w-full">
                <BarChart data={ordersChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    width={30}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="orders"
                    fill="hsl(var(--accent))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center">
                <p className="text-caption text-muted-foreground">No orders this week</p>
              </div>
            )}
          </div>

          {/* Revenue Chart */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-body text-foreground mb-4">Revenue This Week</h3>
            {orders.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[160px] w-full">
                <AreaChart data={ordersChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-green))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${v}`}
                    width={40}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`$${value}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--chart-green))"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center">
                <p className="text-caption text-muted-foreground">No revenue this week</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Activity Feed - Takes 1 column */}
          <div className="card-neesh lg:row-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-heading text-foreground">Recent Activity</h3>
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
            {activityFeed.length > 0 ? (
              <div className="space-y-0 -mx-4">
                {activityFeed.map((activity, index) => (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer transition-colors ${
                      index !== activityFeed.length - 1 ? 'border-b border-border' : ''
                    }`}
                    onClick={() => navigate(activity.link)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.type === 'application_approved'
                        ? 'bg-status-success/10 text-status-success'
                        : activity.type === 'new_order' || activity.type === 'order_shipped'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-secondary text-muted-foreground'
                    }`}>
                      <activity.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-foreground line-clamp-2">{activity.description}</p>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-caption text-muted-foreground">No recent activity</p>
              </div>
            )}
          </div>

          {/* Recent Orders - Takes 2 columns */}
          <div className="card-neesh lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-heading text-foreground">Recent Orders</h3>
              <button
                onClick={() => navigate("/admin/orders")}
                className="text-caption text-accent hover:underline"
              >
                View all
              </button>
            </div>
            {recentOrders.length > 0 ? (
              <DataTable
                columns={orderColumns}
                data={recentOrders as unknown as Record<string, unknown>[]}
                onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
              />
            ) : (
              <div className="text-center py-8">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-caption text-muted-foreground">No orders yet this week</p>
              </div>
            )}
          </div>

          {/* Recent Applications - Takes 2 columns */}
          <div className="card-neesh lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-heading text-foreground">Recent Applications</h3>
              <button
                onClick={() => navigate("/admin/applications")}
                className="text-caption text-accent hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {recentApplications.length > 0 ? (
                recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer group"
                    onClick={() => navigate(`/admin/applications/${app.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        app.type === 'Publisher' ? 'bg-accent/10' : 'bg-secondary'
                      }`}>
                        {app.type === 'Publisher' ? (
                          <FileText className="w-4 h-4 text-accent" />
                        ) : (
                          <Store className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-body text-foreground truncate">{app.name}</p>
                        <p className="text-caption text-muted-foreground">{app.type} • {app.submitted}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={app.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-caption">No recent applications</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
