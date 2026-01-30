import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, ChevronDown, ChevronUp, AlertCircle, BookOpen } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, ProgressBar, DataTable, StatusBadge, EmptyState, ButtonPrimary } from "@/components/neesh";
import { LoadingScreen, OnboardingChecklist } from "@/components/shared";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { useMagazines } from "@/hooks/useMagazines";
import { Order, useOrders } from "@/hooks/useOrders";
import { PublisherOnboardingPrompt } from "@/components/publisher/PublisherOnboardingPrompt";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";

// Mock sales chart data (would come from analytics in production)
const salesChartData = [
  { month: "Jan", sales: 1200 },
  { month: "Feb", sales: 1800 },
  { month: "Mar", sales: 1400 },
  { month: "Apr", sales: 2200 },
  { month: "May", sales: 2800 },
  { month: "Jun", sales: 3200 },
];

const timePeriods = ["D", "W", "M", "Q", "YTD", "Y", "ALL"];

export const PublisherDashboard = () => {
  const navigate = useNavigate();
  const [activePeriod, setActivePeriod] = useState("M");
  const [titlesExpanded, setTitlesExpanded] = useState(true);

  const { publisher, isLoading: publisherLoading, error: publisherError } = usePublisherProfile();
  const { magazines, isLoading: magazinesLoading, error: magazinesError, refetch: refetchMagazines } = useMagazines({
    publisherId: publisher?.id,
  });
  const { orders, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useOrders({
    publisherId: publisher?.id,
    limit: 5,
  });

  const isLoading = publisherLoading || (publisher && (magazinesLoading || ordersLoading));
  const error = publisherError || magazinesError || ordersError;

  // Onboarding progress
  const onboarding = useOnboardingProgress('publisher', {
    hasProfileBio: !!publisher?.description,
    hasProfileWebsite: !!publisher?.website_url,
    hasProfileInstagram: !!publisher?.instagram_handle,
    titleCount: magazines.length,
    publisherName: publisher?.company_name || undefined,
  });

  const handleTransfer = () => {
    navigate("/publisher/transfers");
  };

  const orderColumns = [
    { key: "order_number", header: "Order" },
    { key: "magazine", header: "Title", render: (value: Order['magazine']) => value?.title || "Unknown" },
    { key: "total_amount", header: "Total", render: (value: number) => `$${value.toFixed(2)}` },
    { key: "created_at", header: "Time", render: (value: string) => {
      const date = new Date(value);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    }},
    { key: "quantity", header: "Volume" },
    { key: "fulfillment_status", header: "Fulfillment", render: (value: string) => <StatusBadge status={value as 'pending' | 'shipped' | 'delivered' | 'cancelled'} /> },
  ];

  if (isLoading) {
    return (
      <PublisherLayout>
        <LoadingScreen message="Loading dashboard..." />
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
            action={<ButtonPrimary onClick={() => { refetchMagazines(); refetchOrders(); }}>Try Again</ButtonPrimary>}
          />
        </div>
      </PublisherLayout>
    );
  }

  // Calculate totals from real data
  const totalSales = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalSold = orders.reduce((sum, order) => sum + order.quantity, 0);
  const totalInventory = magazines.reduce((sum, mag) => sum + (mag.inventory_count || 0), 0);

  return (
    <PublisherLayout>
      <BackNavigation
        title="Overview"
        onBack={() => navigate("/")}
        rightContent={
          <WalletDisplay
            label="Account Balance"
            amount={publisher?.total_sales || 0}
            actionLabel="Transfer"
            onAction={handleTransfer}
          />
        }
      />

      {/* Onboarding Checklist for new users */}
      {!onboarding.dismissed && !onboarding.allComplete && (
        <div className="px-4 md:px-6">
          <OnboardingChecklist
            items={onboarding.items}
            userName={publisher?.company_name}
            welcomeTitle="Welcome to Neesh!"
            welcomeSubtitle="Let's get your storefront set up. Complete these steps to start receiving orders."
            onDismiss={onboarding.markDismissed}
            onItemClick={onboarding.markItemViewed}
          />
        </div>
      )}

      {/* Onboarding prompt for users who skipped onboarding */}
      {onboarding.dismissed && !onboarding.allComplete && (
        <div className="px-4 md:px-6">
          <PublisherOnboardingPrompt />
        </div>
      )}

      {/* Hero Metrics Section */}
      <div className="px-4 md:px-6 pb-6">
        <div className="card-neesh">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Total Sales Card */}
            <div className="lg:w-1/3">
              <p className="text-caption text-muted-foreground mb-1">Total Sales</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display font-bold text-display-md text-foreground">${totalSales.toFixed(2)}</span>
                <div className="flex items-center gap-1 text-chart-green">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-body font-medium">+12.30%</span>
                </div>
              </div>
              <p className="text-caption text-muted-foreground mt-2">{totalSold}/{totalInventory + totalSold} Sold</p>
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
                {magazines.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen className="w-8 h-8 text-muted-foreground" />}
                    title="No titles yet"
                    description="Add your first magazine to start receiving orders"
                    action={<ButtonPrimary onClick={() => navigate("/publisher/titles/new")}>Add Your First Title</ButtonPrimary>}
                  />
                ) : (
                  magazines.slice(0, 5).map((title) => (
                    <div
                      key={title.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                      onClick={() => navigate(`/publisher/titles/${title.id}/edit`)}
                    >
                      <img
                        src={title.cover_image_url || "/placeholder.svg"}
                        alt={title.title}
                        className="w-12 h-16 object-cover rounded bg-secondary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-medium text-body text-foreground truncate">
                          {title.title}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {title.inventory_count || 0} in stock
                        </p>
                        <div className="mt-2">
                          <ProgressBar current={title.inventory_count || 0} total={(title.inventory_count || 0) + (title.sold_count || 0) || 100} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Latest Orders */}
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Latest Orders</h3>
            {orders.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-8 h-8 text-muted-foreground" />}
                title="No orders yet"
                description="When retailers purchase your titles, orders will appear here"
              />
            ) : (
              <DataTable
                columns={orderColumns}
                data={orders}
                onRowClick={(order) => navigate(`/publisher/orders/${order.id}`)}
              />
            )}
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherDashboard;
