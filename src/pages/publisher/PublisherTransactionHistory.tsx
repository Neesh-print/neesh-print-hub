import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Building2, Store, ArrowRight, Receipt, Loader2 } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, TabNavigation, EmptyState } from "@/components/neesh";
import { usePublisherTransfers } from "@/hooks/usePublisherTransfers";
import { format } from "date-fns";

const tabs = [
  { id: "history", label: "Transaction History" },
  { id: "transfers", label: "Transfers" },
];

interface TransactionGroup {
  date: string;
  items: {
    type: string;
    name: string;
    account?: string;
    label: string;
    amount: number;
    status: string;
  }[];
}

export const PublisherTransactionHistory = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("history");
  const { transfers, isLoading } = usePublisherTransfers();

  // Group transfers by date
  const transactions: TransactionGroup[] = useMemo(() => {
    const groupMap = new Map<string, TransactionGroup>();

    for (const t of transfers) {
      const dateKey = format(new Date(t.created_at), "MMMM d, yyyy");
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, { date: dateKey, items: [] });
      }

      const statusLabel = t.status === "transferred"
        ? "Completed"
        : t.status === "failed"
          ? "Failed"
          : "Pending";

      groupMap.get(dateKey)!.items.push({
        type: t.status === "transferred" ? "bank" : "store",
        name: t.order_number || "Order",
        label: statusLabel,
        amount: t.status === "transferred" ? t.net_amount : t.net_amount,
        status: t.status,
      });
    }

    return Array.from(groupMap.values());
  }, [transfers]);

  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  // Expand all dates when data loads
  useMemo(() => {
    if (transactions.length > 0 && expandedDates.length === 0) {
      setExpandedDates(transactions.map(t => t.date));
    }
  }, [transactions]);

  const toggleDate = (date: string) => {
    if (expandedDates.includes(date)) {
      setExpandedDates(expandedDates.filter(d => d !== date));
    } else {
      setExpandedDates([...expandedDates, date]);
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "transfers") {
      navigate("/publisher/transfers");
    }
  };

  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toFixed(2);
    return `+$${formatted}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "transferred":
        return "text-chart-green";
      case "failed":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title="Transaction History"
        onBack={() => navigate("/publisher")}
      />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="px-4 md:px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-12 h-12" />}
            title="No transactions yet"
            description="Your sales and payouts will be recorded here"
          />
        ) : (
        <div className="space-y-4">
          {transactions.map((group) => (
            <div key={group.date} className="card-neesh">
              <button
                onClick={() => toggleDate(group.date)}
                className="w-full flex items-center justify-between"
              >
                <span className="font-display font-semibold text-body text-foreground">
                  {group.date}
                </span>
                {expandedDates.includes(group.date) ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {expandedDates.includes(group.date) && (
                <div className="mt-4 space-y-3">
                  {group.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-3 border-t border-border first:border-0 first:pt-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          {item.type === "bank" ? (
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <Store className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-body text-foreground font-medium">{item.name}</span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <span className={`text-body ${
                            item.status === "pending"
                              ? "text-status-warning-text"
                              : item.status === "failed"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}>
                            {item.label}
                          </span>
                        </div>
                      </div>
                      <span className={`font-display font-medium text-body ${getStatusColor(item.status)}`}>
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        )}
      </div>
    </PublisherLayout>
  );
};

export default PublisherTransactionHistory;
