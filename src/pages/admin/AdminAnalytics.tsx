import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Loader2, AlertCircle } from "lucide-react";
import { AdminLayout, StatCard, DateRangePicker } from "@/components/admin";
import { BackNavigation, DataTable, ButtonSecondary } from "@/components/neesh";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, startOfDay } from "date-fns";

interface OrderData {
  id: string;
  total_price: number;
  created_at: string;
  status: string;
  retailer_id: string;
  magazine_id: string;
  quantity: number;
}

interface PublisherRevenue {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  percentage: number;
  [key: string]: unknown;
}

interface MagazineRevenue {
  id: string;
  title: string;
  publisher: string;
  unitsSold: number;
  revenue: number;
  [key: string]: unknown;
}

export const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [publishers, setPublishers] = useState<Record<string, string>>({});
  const [magazines, setMagazines] = useState<Record<string, { title: string; publisher_id: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch orders in date range
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, total_price, created_at, status, retailer_id, magazine_id, quantity')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: true });

      if (orderError) throw orderError;
      setOrders(orderData || []);

      // Fetch publishers
      const { data: pubData } = await supabase
        .from('publishers')
        .select('id, company_name');

      const pubMap: Record<string, string> = {};
      (pubData || []).forEach((p: any) => {
        pubMap[p.id] = p.company_name || 'Unknown';
      });
      setPublishers(pubMap);

      // Fetch magazines
      const { data: magData } = await supabase
        .from('magazines')
        .select('id, title, publisher_id');

      const magMap: Record<string, { title: string; publisher_id: string }> = {};
      (magData || []).forEach((m: any) => {
        magMap[m.id] = { title: m.title, publisher_id: m.publisher_id };
      });
      setMagazines(magMap);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute metrics
  const grossRevenue = useMemo(() => orders.reduce((sum, o) => sum + Number(o.total_price || 0), 0), [orders]);
  const neeshCommission = grossRevenue * 0.1;
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? grossRevenue / totalOrders : 0;

  // Revenue over time chart data
  const revenueChartData = useMemo(() => {
    if (orders.length === 0) return [];

    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const dayMap: Record<string, { revenue: number; orders: number }> = {};

    days.forEach(day => {
      const key = format(day, "MMM d");
      dayMap[key] = { revenue: 0, orders: 0 };
    });

    orders.forEach(order => {
      const key = format(new Date(order.created_at), "MMM d");
      if (dayMap[key]) {
        dayMap[key].revenue += Number(order.total_price || 0);
        dayMap[key].orders += 1;
      }
    });

    return Object.entries(dayMap).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }));
  }, [orders, dateRange]);

  // Top publishers
  const topPublishers = useMemo((): PublisherRevenue[] => {
    const pubRevenue: Record<string, { revenue: number; orders: number }> = {};

    orders.forEach(order => {
      const mag = magazines[order.magazine_id];
      if (mag) {
        const pubId = mag.publisher_id;
        if (!pubRevenue[pubId]) pubRevenue[pubId] = { revenue: 0, orders: 0 };
        pubRevenue[pubId].revenue += Number(order.total_price || 0);
        pubRevenue[pubId].orders += 1;
      }
    });

    return Object.entries(pubRevenue)
      .map(([id, data]) => ({
        id,
        name: publishers[id] || 'Unknown',
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        percentage: grossRevenue > 0 ? Math.round((data.revenue / grossRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orders, magazines, publishers, grossRevenue]);

  // Top magazines
  const topMagazines = useMemo((): MagazineRevenue[] => {
    const magRevenue: Record<string, { revenue: number; units: number; publisher_id: string }> = {};

    orders.forEach(order => {
      const magId = order.magazine_id;
      const mag = magazines[magId];
      if (mag) {
        if (!magRevenue[magId]) magRevenue[magId] = { revenue: 0, units: 0, publisher_id: mag.publisher_id };
        magRevenue[magId].revenue += Number(order.total_price || 0);
        magRevenue[magId].units += order.quantity;
      }
    });

    return Object.entries(magRevenue)
      .map(([id, data]) => ({
        id,
        title: magazines[id]?.title || 'Unknown',
        publisher: publishers[data.publisher_id] || 'Unknown',
        unitsSold: data.units,
        revenue: Math.round(data.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orders, magazines, publishers]);

  const publisherColumns = [
    { key: "name", header: "Publisher" },
    { key: "revenue", header: "Revenue", align: "right" as const, render: (v: unknown) => `$${(v as number).toLocaleString()}` },
    { key: "orders", header: "Orders", align: "center" as const },
    { key: "percentage", header: "% of Total", align: "right" as const, render: (v: unknown) => `${v}%` },
  ];

  const magazineColumns = [
    { key: "title", header: "Magazine" },
    { key: "publisher", header: "Publisher" },
    { key: "unitsSold", header: "Units", align: "center" as const },
    { key: "revenue", header: "Revenue", align: "right" as const, render: (v: unknown) => `$${(v as number).toLocaleString()}` },
  ];

  if (error) {
    return (
      <AdminLayout>
        <div className="px-4 md:px-6">
          <BackNavigation title="Analytics" onBack={() => navigate("/admin")} />
        </div>
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-status-error-text mb-3" />
            <h3 className="font-display font-semibold text-heading text-foreground mb-1">Failed to load analytics</h3>
            <p className="text-body text-muted-foreground mb-4">{error}</p>
            <ButtonSecondary onClick={fetchData}>Try Again</ButtonSecondary>
          </div>
        </div>
      </AdminLayout>
    );
  }

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

      {isLoading ? (
        <div className="px-4 md:px-6 pb-8 flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-body text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Top Metrics */}
          <div className="px-4 md:px-6 pb-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Gross Revenue"
                value={`$${grossRevenue.toLocaleString()}`}
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
              />
              <StatCard
                label="Avg Order Value"
                value={`$${avgOrderValue.toFixed(2)}`}
              />
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="px-4 md:px-6 pb-6">
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Revenue Over Time</h3>
              {revenueChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChartData}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-caption" />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
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
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-caption text-muted-foreground">No revenue data for this period</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Publishers & Magazines */}
          <div className="px-4 md:px-6 pb-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card-neesh">
                <h3 className="font-display font-semibold text-heading text-foreground mb-4">Top Publishers</h3>
                {topPublishers.length > 0 ? (
                  <DataTable
                    columns={publisherColumns}
                    data={topPublishers as unknown as Record<string, unknown>[]}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-caption text-muted-foreground">No publisher data for this period</p>
                  </div>
                )}
              </div>
              <div className="card-neesh">
                <h3 className="font-display font-semibold text-heading text-foreground mb-4">Top Magazines</h3>
                {topMagazines.length > 0 ? (
                  <DataTable
                    columns={magazineColumns}
                    data={topMagazines as unknown as Record<string, unknown>[]}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-caption text-muted-foreground">No magazine data for this period</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminAnalytics;
