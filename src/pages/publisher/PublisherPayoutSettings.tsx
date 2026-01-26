import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, FormInput, FormSelect, ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

type PayoutMethod = "bank_account" | "paypal";

export const PublisherPayoutSettings = () => {
  const navigate = useNavigate();
  
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("bank_account");
  const [isSaving, setIsSaving] = useState(false);
  
  // Bank account fields
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  
  // PayPal fields
  const [paypalEmail, setPaypalEmail] = useState("");
  
  // Payout schedule
  const [payoutSchedule, setPayoutSchedule] = useState("monthly_15");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate API call - in production this would update the payout settings
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    toast.success("Payout method updated successfully");
    navigate("/publisher/settings#payouts");
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title="Update Payout Method"
        onBack={() => navigate("/publisher/settings")}
      />

      <div className="px-4 md:px-6 pb-12 max-w-2xl mx-auto">
        <p className="text-muted-foreground mb-6">
          Update your payout details to receive payments for your sales.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payout Method Selection */}
          <div className="card-neesh space-y-4">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Payout Method
            </h3>
            
            <RadioGroup
              value={payoutMethod}
              onValueChange={(value) => setPayoutMethod(value as PayoutMethod)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-secondary/50 transition-colors">
                <RadioGroupItem value="bank_account" id="bank_account" />
                <Label htmlFor="bank_account" className="flex-1 cursor-pointer">
                  <div className="font-medium">Bank Account (ACH)</div>
                  <div className="text-sm text-muted-foreground">Direct deposit to your bank account</div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-secondary/50 transition-colors">
                <RadioGroupItem value="paypal" id="paypal" />
                <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                  <div className="font-medium">PayPal</div>
                  <div className="text-sm text-muted-foreground">Receive payments to your PayPal account</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Bank Account Details */}
          {payoutMethod === "bank_account" && (
            <div className="card-neesh space-y-4">
              <h3 className="font-display font-semibold text-lg text-foreground">
                Bank Account Details
              </h3>
              
              <FormInput
                label="Bank Name"
                value={bankName}
                onChange={setBankName}
                placeholder="e.g. Chase, Bank of America"
                required
              />
              
              <FormInput
                label="Account Holder Name"
                value={accountHolderName}
                onChange={setAccountHolderName}
                placeholder="Name as it appears on the account"
                required
              />
              
              <FormSelect
                label="Account Type"
                value={accountType}
                onChange={setAccountType}
                options={[
                  { value: "checking", label: "Checking" },
                  { value: "savings", label: "Savings" },
                ]}
              />
              
              <FormInput
                label="Routing Number"
                value={routingNumber}
                onChange={setRoutingNumber}
                placeholder="9-digit routing number"
                required
              />
              
              <FormInput
                label="Account Number"
                value={accountNumber}
                onChange={setAccountNumber}
                placeholder="Your account number"
                required
              />
              
              <p className="text-sm text-muted-foreground">
                Your bank details are encrypted and stored securely.
              </p>
            </div>
          )}

          {/* PayPal Details */}
          {payoutMethod === "paypal" && (
            <div className="card-neesh space-y-4">
              <h3 className="font-display font-semibold text-lg text-foreground">
                PayPal Details
              </h3>
              
              <FormInput
                label="PayPal Email"
                type="email"
                value={paypalEmail}
                onChange={setPaypalEmail}
                placeholder="your-email@example.com"
                required
              />
              
              <p className="text-sm text-muted-foreground">
                Make sure this email is linked to your PayPal account.
              </p>
            </div>
          )}

          {/* Payout Schedule */}
          <div className="card-neesh space-y-4">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Payout Schedule
            </h3>
            
            <FormSelect
              label="When to receive payouts"
              value={payoutSchedule}
              onChange={setPayoutSchedule}
              options={[
                { value: "monthly_1", label: "Monthly, on the 1st" },
                { value: "monthly_15", label: "Monthly, on the 15th" },
                { value: "biweekly", label: "Bi-weekly (every 2 weeks)" },
                { value: "weekly", label: "Weekly" },
              ]}
            />
            
            <p className="text-sm text-muted-foreground">
              Payouts require a minimum balance of $50. Amounts below this threshold will roll over to the next payout period.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <ButtonSecondary
              type="button"
              onClick={() => navigate("/publisher/settings")}
            >
              Cancel
            </ButtonSecondary>
            <ButtonPrimary type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Payout Settings"}
            </ButtonPrimary>
          </div>
        </form>
      </div>
    </PublisherLayout>
  );
};

export default PublisherPayoutSettings;
