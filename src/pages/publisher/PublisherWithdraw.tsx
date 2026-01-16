import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, Building2 } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, TabNavigation, ButtonPrimary } from "@/components/neesh";

const tabs = [
  { id: "transfers", label: "Transfers" },
  { id: "history", label: "Transaction History" },
];

export const PublisherWithdraw = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("transfers");
  const [amount, setAmount] = useState("1000.00");
  const [transferSpeed, setTransferSpeed] = useState<"instant" | "standard">("instant");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "history") {
      navigate("/publisher/transactions");
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(value);
  };

  const clearAmount = () => {
    setAmount("");
  };

  const handleTransfer = () => {
    console.log("Transferring:", amount, "with speed:", transferSpeed);
    navigate("/publisher/transfers");
  };

  const numericAmount = parseFloat(amount) || 0;

  return (
    <PublisherLayout>
      <BackNavigation
        title="Transfers"
        onBack={() => navigate("/publisher/transfers")}
        rightContent={
          <WalletDisplay
            label="Balance"
            amount={2720.00}
            actionLabel=""
            onAction={() => {}}
          />
        }
      />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="px-4 md:px-6 py-8">
        <div className="max-w-md mx-auto">
          {/* Amount Input */}
          <div className="text-center mb-4">
            <div className="relative inline-flex items-center">
              <span className="font-display font-bold text-display-lg text-foreground">$</span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className="font-display font-bold text-display-lg text-foreground bg-transparent border-0 outline-none text-center w-48"
                placeholder="0.00"
              />
              {amount && (
                <button
                  onClick={clearAmount}
                  className="absolute -right-8 p-1 rounded-full hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-body text-muted-foreground mt-2">
              Withdraw up to $2,720.00
            </p>
          </div>

          {/* Transfer Speed Toggle */}
          <div className="card-neesh mb-6">
            <div className="flex">
              <button
                onClick={() => setTransferSpeed("instant")}
                className={`flex-1 py-4 text-center border-b-2 transition-colors ${
                  transferSpeed === "instant"
                    ? "border-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <p className="font-display font-semibold text-body">Instant Transfer</p>
                <p className="text-caption text-muted-foreground">Just a few minutes</p>
              </button>
              <button
                onClick={() => setTransferSpeed("standard")}
                className={`flex-1 py-4 text-center border-b-2 transition-colors ${
                  transferSpeed === "standard"
                    ? "border-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <p className="font-display font-semibold text-body">3-7 Business Days</p>
                <p className="text-caption text-muted-foreground">Est: Tuesday August 26</p>
              </button>
            </div>
          </div>

          {/* Bank Selection */}
          <button className="w-full card-neesh flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-foreground" />
              </div>
              <div className="text-left">
                <p className="font-display font-medium text-body text-foreground">Chase Bank</p>
                <p className="text-caption text-muted-foreground">••••4521</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Transfer Button */}
          <ButtonPrimary
            fullWidth
            onClick={handleTransfer}
            disabled={numericAmount <= 0 || numericAmount > 2720}
          >
            Transfer ${numericAmount.toFixed(2)}
          </ButtonPrimary>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherWithdraw;
