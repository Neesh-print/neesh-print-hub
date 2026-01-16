import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Building2, Store, ArrowRight } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, TabNavigation } from "@/components/neesh";

const tabs = [
  { id: "history", label: "Transaction History" },
  { id: "transfers", label: "Transfers" },
];

const mockTransactions = [
  {
    date: "September 13 2025",
    items: [
      { type: "bank", name: "Chase Bank", account: "••••4521", label: "Instant Transfer", amount: -1000.00 },
      { type: "retailer", name: "Brooklyn Books", label: "Retailer Payment", amount: 450.00 },
    ]
  },
  {
    date: "September 10 2025",
    items: [
      { type: "retailer", name: "Powell's Books", label: "Retailer Payment", amount: 320.00 },
      { type: "retailer", name: "Strand Bookstore", label: "Retailer Payment", amount: 280.00 },
    ]
  },
  {
    date: "September 5 2025",
    items: [
      { type: "bank", name: "Chase Bank", account: "••••4521", label: "Instant Transfer", amount: -500.00 },
    ]
  },
  {
    date: "September 1 2025",
    items: [
      { type: "retailer", name: "City Lights", label: "Retailer Payment", amount: 560.00 },
      { type: "retailer", name: "The Last Bookstore", label: "Retailer Payment", amount: 420.00 },
    ]
  },
];

export const PublisherTransactionHistory = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("history");
  const [expandedDates, setExpandedDates] = useState<string[]>(mockTransactions.map(t => t.date));

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
    return amount < 0 ? `-$${formatted}` : `+$${formatted}`;
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title="Transaction History"
        onBack={() => navigate("/publisher")}
      />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="px-4 md:px-6 py-6">
        <div className="space-y-4">
          {mockTransactions.map((group) => (
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
                          {item.account && (
                            <span className="text-caption text-muted-foreground">{item.account}</span>
                          )}
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <span className="text-body text-muted-foreground">{item.label}</span>
                        </div>
                      </div>
                      <span className={`font-display font-medium text-body ${
                        item.amount < 0 ? "text-destructive" : "text-chart-green"
                      }`}>
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherTransactionHistory;
