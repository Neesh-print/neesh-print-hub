import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, Building2, AlertCircle, Loader2 } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, TabNavigation, ButtonPrimary } from "@/components/neesh";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const tabs = [
  { id: "transfers", label: "Transfers" },
  { id: "history", label: "Transaction History" },
];

export const PublisherWithdraw = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("transfers");
  const [amount, setAmount] = useState("");
  const [transferSpeed, setTransferSpeed] = useState<"instant" | "standard">("standard"); // Default to standard usually
  
  const [balance, setBalance] = useState<{ available: number; pending: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "history") {
      navigate("/publisher/transactions");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
      try {
          const { data, error } = await supabase.functions.invoke('get-stripe-balance');
          if (error) throw error;
          
          if (data) {
              // Stripe returns amounts in cents
              const avail = data.available?.reduce((sum: number, b: any) => sum + b.amount, 0) || 0;
              const pend = data.pending?.reduce((sum: number, b: any) => sum + b.amount, 0) || 0;
              setBalance({
                  available: avail / 100,
                  pending: pend / 100
              });
          }
      } catch (err) {
          console.error("Failed to fetch balance", err);
          toast.error("Could not load account balance");
      } finally {
          setIsLoading(false);
      }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(value);
  };

  const clearAmount = () => {
    setAmount("");
  };

  const handleTransfer = async () => {
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) return;

    setIsTransferring(true);
    try {
        const { data, error } = await supabase.functions.invoke('create-stripe-payout', {
            body: { amount: numericAmount }
        });

        if (error) {
            // Check if it's a known Stripe error
            throw new Error(data?.error || error.message);
        }

        toast.success(`Successfully initiated transfer of $${numericAmount.toFixed(2)}`);
        setAmount("");
        fetchBalance(); // Refresh balance
        // navigate("/publisher/transfers"); // Maybe stay on page to show updated balance?
    } catch (err: any) {
        console.error("Transfer failed", err);
        toast.error(err.message || "Transfer failed. Please check your dashboard settings.");
    } finally {
        setIsTransferring(false);
    }
  };

  const numericAmount = parseFloat(amount) || 0;
  const maxdrawable = balance?.available || 0;

  if (isLoading) {
      return (
          <PublisherLayout>
              <div className="flex items-center justify-center min-h-[50vh]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
          </PublisherLayout>
      );
  }

  return (
    <PublisherLayout>
      <BackNavigation
        title="Transfers"
        onBack={() => navigate("/publisher/transfers")}
        rightContent={
          <WalletDisplay
            label="Pending Balance"
            amount={balance?.pending || 0}
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
                className="font-display font-bold text-display-lg text-foreground bg-transparent border-0 outline-none text-center w-48 placeholder:text-muted-foreground/30"
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
              Available to withdraw: ${maxdrawable.toFixed(2)}
            </p>
          </div>

          {/* Transfer Speed Toggle */}
          <div className="card-neesh mb-6">
            <div className="flex">
              <button
                // Instant might not be available for all express accounts without config, keeping UI but default to standard
                onClick={() => setTransferSpeed("instant")}
                className={`flex-1 py-4 text-center border-b-2 transition-colors ${
                  transferSpeed === "instant"
                    ? "border-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <p className="font-display font-semibold text-body">Instant Transfer</p>
                <p className="text-caption text-muted-foreground">Fees may apply</p>
              </button>
              <button
                onClick={() => setTransferSpeed("standard")}
                className={`flex-1 py-4 text-center border-b-2 transition-colors ${
                  transferSpeed === "standard"
                    ? "border-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <p className="font-display font-semibold text-body">Standard</p>
                <p className="text-caption text-muted-foreground">1-3 Business Days</p>
              </button>
            </div>
          </div>

          {/* Bank Selection - Mock for now as Stripe handles this, visual indicator */}
          <button className="w-full card-neesh flex items-center justify-between mb-6 pointer-events-none opacity-80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-foreground" />
              </div>
              <div className="text-left">
                <p className="font-display font-medium text-body text-foreground">Connected Bank Account</p>
                <p className="text-caption text-muted-foreground">Managed via Stripe</p>
              </div>
            </div>
            {/* <ChevronRight className="w-5 h-5 text-muted-foreground" /> */}
          </button>

          {/* Transfer Button */}
          <ButtonPrimary
            fullWidth
            onClick={handleTransfer}
            disabled={
                numericAmount <= 0 || 
                numericAmount > maxdrawable || 
                isTransferring
            }
          >
            {isTransferring ? (
                <>
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                 Processing...
                </>
            ) : (
                `Transfer $${numericAmount.toFixed(2)}`
            )}
          </ButtonPrimary>
          
          {numericAmount > maxdrawable && (
             <p className="text-center text-destructive text-caption mt-2">
                 Amount exceeds available balance.
             </p>
          )}
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherWithdraw;
