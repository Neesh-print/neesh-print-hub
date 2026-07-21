import { useNavigate } from "react-router-dom";
import { Landmark, IdCard, Clock, ShieldCheck } from "lucide-react";
import { ButtonPrimary } from "@/components/neesh";

// Pre-flight page shown before the Stripe redirect. It sets expectations so the
// publisher knows what Stripe is, why Neesh uses it, and what to have ready.
// Static — the only action is continuing to /onboarding/continue.
export const OnboardingStart = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="card-neesh space-y-6">
          <div className="space-y-2">
            <h1 className="font-display font-semibold text-heading text-foreground">
              Set up payouts
            </h1>
            <p className="text-muted-foreground">
              Neesh uses Stripe to send you payments for your orders. Stripe is the payments provider
              trusted by millions of businesses to move money securely. On the next screen you will give
              Stripe your payout details so we can pay you.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">What to have ready:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Landmark className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">Your bank account details, so payouts can reach you.</span>
              </li>
              <li className="flex items-start gap-3">
                <IdCard className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  A tax ID or Social Security number. Stripe needs this to verify who is being paid.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">About five minutes.</span>
              </li>
            </ul>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary">
            <ShieldCheck className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              If you are a sole proprietor or your publication is not incorporated, choose{" "}
              <span className="font-medium text-foreground">individual</span> when Stripe asks about your
              business type.
            </p>
          </div>

          <div className="pt-2">
            <ButtonPrimary onClick={() => navigate("/onboarding/continue")} className="w-full sm:w-auto">
              Continue to Stripe
            </ButtonPrimary>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStart;
