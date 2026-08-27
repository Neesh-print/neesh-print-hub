import { useNavigate } from "react-router-dom";
import { AlertCircle, Clock } from "lucide-react";
import { ButtonPrimary } from "@/components/neesh";
import type { PublisherProfile } from "@/hooks/usePublisherProfile";
import { humanizeRequirements } from "@/lib/stripeRequirements";

interface PublisherPayoutBannerProps {
  publisher: Pick<
    PublisherProfile,
    "stripe_account_id" | "stripe_payouts_enabled" | "stripe_details_submitted" | "stripe_requirements_due"
  > | null;
  // When the dashboard onboarding checklist is visible it already nudges the
  // publisher to set up payouts, so the "not started" state is suppressed to
  // avoid showing the same prompt twice. The under-review and incomplete states
  // still show, since the checklist does not cover them.
  onboardingChecklistVisible?: boolean;
}

// Persistent (non-dismissible) status banner shown on the publisher dashboard
// whenever the publisher cannot yet receive payouts. Three states:
//   1. Under review  — details submitted, Stripe still verifying. Nothing to do.
//   2. Not started   — no connected account yet.
//   3. Incomplete    — onboarding started but not finished; lists what's missing.
export const PublisherPayoutBanner = ({ publisher, onboardingChecklistVisible }: PublisherPayoutBannerProps) => {
  const navigate = useNavigate();

  // Payouts working, or profile not loaded yet — nothing to show.
  if (!publisher || publisher.stripe_payouts_enabled) {
    return null;
  }

  // State 1: submitted and waiting on Stripe. This is Stripe's review, not the
  // publisher's task, so it stays calm with no call to action.
  if (publisher.stripe_details_submitted) {
    return (
      <div className="px-4 md:px-6 pb-6">
        <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <Clock className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-medium text-foreground">Your payout details are being reviewed</h3>
            <p className="text-sm text-muted-foreground">
              Stripe is verifying the information you submitted. You cannot receive payments until that
              is finished, but there is nothing you need to do right now. This usually takes a day or two.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // States 2 and 3: the publisher has something to complete.
  const outstanding = humanizeRequirements(publisher.stripe_requirements_due);
  const hasAccount = !!publisher.stripe_account_id;

  // State 2 (not started) overlaps with the onboarding checklist's payout step,
  // so suppress it while the checklist is on screen.
  if (!hasAccount && onboardingChecklistVisible) {
    return null;
  }

  return (
    <div className="px-4 md:px-6 pb-6">
      <div className="flex flex-col gap-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 sm:flex-row sm:items-start">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <h3 className="font-medium text-foreground">You cannot receive payments yet</h3>
          <p className="text-sm text-muted-foreground">
            {hasAccount
              ? "Your payout setup is not finished, so we cannot pay you for orders. It takes about five minutes to complete."
              : "Set up a payout account so we can pay you for orders. It takes about five minutes."}
          </p>

          {hasAccount && outstanding.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p>To finish, Stripe still needs:</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {outstanding.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="sm:pt-0">
          <ButtonPrimary onClick={() => navigate("/onboarding/continue")}>
            {hasAccount ? "Continue payout setup" : "Set up payouts"}
          </ButtonPrimary>
        </div>
      </div>
    </div>
  );
};

export default PublisherPayoutBanner;
