import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, CreditCard } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, TabNavigation, InfoCard } from "@/components/neesh";

const tabs = [
  { id: "transfers", label: "Transfers" },
  { id: "history", label: "Transaction History" },
];

export const PublisherTransfers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("transfers");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "history") {
      navigate("/publisher/transactions");
    }
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title="Transfers"
        onBack={() => navigate("/publisher")}
      />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="px-4 md:px-6 py-8">
        <div className="max-w-md mx-auto text-center">
          {/* Account Balance */}
          <p className="text-caption text-muted-foreground mb-2">Account Balance</p>
          <p className="font-display font-bold text-display-lg text-foreground mb-2">
            $2,720.00
          </p>
          <p className="text-body text-muted-foreground mb-8">
            Withdraw up to $2,720.00
          </p>

          {/* Action Cards */}
          <div className="space-y-4">
            <InfoCard onClick={() => navigate("/publisher/transfers/withdraw")}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Upload className="w-6 h-6 text-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-display font-semibold text-body text-foreground">Withdraw</p>
                  <p className="text-caption text-muted-foreground">Transfer funds to your bank</p>
                </div>
              </div>
            </InfoCard>

            <InfoCard onClick={() => console.log("Payment methods")}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-display font-semibold text-body text-foreground">Payment Methods</p>
                  <p className="text-caption text-muted-foreground">Manage your bank accounts</p>
                </div>
              </div>
            </InfoCard>
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherTransfers;
