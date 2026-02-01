import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, CreditCard, Loader2 } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, TabNavigation, InfoCard } from "@/components/neesh";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { id: "transfers", label: "Transfers" },
  { id: "history", label: "Transaction History" },
];

export const PublisherTransfers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("transfers");
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
        try {
            const { data, error } = await supabase.functions.invoke('get-stripe-balance');
            if (data) {
                const avail = data.available?.reduce((sum: number, b: any) => sum + b.amount, 0) || 0;
                setBalance(avail / 100);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    fetchBalance();
  }, []);

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
          <div className="min-h-[3rem] flex items-center justify-center mb-2">
            {isLoading ? (
               <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
                <p className="font-display font-bold text-display-lg text-foreground">
                    ${(balance || 0).toFixed(2)}
                </p>
            )}
          </div>
          <p className="text-body text-muted-foreground mb-8">
             {isLoading ? "Loading..." : `Withdraw up to $${(balance || 0).toFixed(2)}`}
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

            <InfoCard onClick={() => navigate("/publisher/settings/payout")}>
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
