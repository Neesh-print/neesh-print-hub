import { useMemo } from 'react';
import { useOrders, Order } from './useOrders';
import { startOfDay, subDays, format, isSameDay, startOfMonth, subMonths } from 'date-fns';

export interface DailyRevenue {
  date: string; // ISO date string or formatted label
  revenue: number;
  orders: number;
}

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  revenueByDate: DailyRevenue[];
  topTitles: { id: string; title: string; revenue: number; units: number; cover: string }[];
  ordersByStatus: { name: string; value: number; color: string }[];
}

export const usePublisherAnalytics = (publisherId?: string, daysToCheck = 30) => {
  // We fetch all orders for the relevant period to calculate metrics client-side
  // For larger scale, this should be an RPC or Edge Function, but for now client-side aggregation is fine
  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(() => subDays(endDate, daysToCheck), [endDate, daysToCheck]);

  const { orders, isLoading, error } = useOrders({
    publisherId,
    dateRange: { start: startDate, end: endDate },
    status: 'all', // analytics should probably include all orders, or maybe just paid ones? usually paid.
    // 'all' includes pending, we probably want to filter for 'paid' or completed for revenue stats
  });

  const metrics: AnalyticsMetrics = useMemo(() => {
    // Filter for valid orders (e.g. not cancelled, maybe pending is okay if we want to show potential revenue?)
    // Let's stick to 'paid', 'packed', 'shipped', 'delivered' for Revenue stats.
    const validOrders = orders.filter(o => 
      ['paid', 'packed', 'shipped', 'delivered'].includes(o.payment_status || o.status)
    );

    const totalRevenue = validOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const totalOrders = validOrders.length;
    const totalUnitsSold = validOrders.reduce((sum, order) => sum + (order.quantity || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Daily Revenue for Chart
    // Initialize array with 0s for every day in range
    const revenueByDate: DailyRevenue[] = [];
    for (let i = 0; i < daysToCheck; i++) {
        const date = subDays(endDate, daysToCheck - 1 - i); // oldest to newest
        revenueByDate.push({
            date: format(date, 'MMM d'),
            revenue: 0,
            orders: 0
        });
    }

    validOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const dayLabel = format(orderDate, 'MMM d');
        const dayEntry = revenueByDate.find(d => d.date === dayLabel);
        if (dayEntry) {
            dayEntry.revenue += order.total_amount;
            dayEntry.orders += 1;
        }
    });

    // Top Titles
    const titleMap = new Map<string, { id: string; title: string; revenue: number; units: number; cover: string }>();
    validOrders.forEach(order => {
        if (order.magazine) {
            const current = titleMap.get(order.magazine.id) || {
                id: order.magazine.id,
                title: order.magazine.title,
                revenue: 0,
                units: 0,
                cover: order.magazine.cover_image_url || '/placeholder.svg'
            };
            current.revenue += order.total_amount;
            current.units += order.quantity;
            titleMap.set(order.magazine.id, current);
        }
    });
    const topTitles = Array.from(titleMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5); // Top 5

    // Orders by Status
    const statusCounts = {
        pending: 0,
        paid: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
    };
    orders.forEach(order => {
        // Normalize status
        const status = (order.fulfillment_status || order.status).toLowerCase();
        if (status in statusCounts) {
            statusCounts[status as keyof typeof statusCounts]++;
        } else if (status === 'packed') {
            statusCounts['paid']++; // treat packed as paid/confirmed
        }
    });

    const ordersByStatus = [
        { name: 'Pending', value: statusCounts.pending, color: 'hsl(var(--status-pending-text))' },
        { name: 'Confirmed', value: statusCounts.paid, color: 'hsl(var(--chart-purple))' },
        { name: 'Shipped', value: statusCounts.shipped, color: 'hsl(var(--accent))' },
        { name: 'Delivered', value: statusCounts.delivered, color: 'hsl(var(--chart-green))' },
    ].filter(s => s.value > 0);

    return {
        totalRevenue,
        totalOrders,
        totalUnitsSold,
        averageOrderValue,
        revenueByDate,
        topTitles,
        ordersByStatus
    };

  }, [orders, daysToCheck, endDate, startDate]);

  return {
    metrics,
    isLoading,
    error,
    orders // expose raw orders if needed
  };
};
