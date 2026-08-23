import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ButtonPrimary, ButtonSecondary, Logo } from "@/components/neesh";

/**
 * /onboarding/continue — the durable entry point for Stripe payout onboarding.
 *
 * Stripe account links expire after a short window, so the payout-nudge emails
 * link here rather than at a raw Stripe URL. This route mints a fresh link on
 * every visit via the continue-onboarding function and forwards the browser to
 * it. That function also sets Stripe's refresh_url back to this route, so an
 * expired link self-heals: Stripe bounces the browser here and a new link is
 * minted.
 */
export const ContinueOnboarding = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    // Each call mints a new Stripe link, so don't run twice under StrictMode.
    if (hasRun.current) return;
    hasRun.current = true;

    const go = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("continue-onboarding");

        if (fnError || !data?.url) {
          console.error("continue-onboarding failed:", fnError ?? data);
          setError(
            "We couldn't open Stripe payout setup just now. Please try again, or start it from your payout settings."
          );
          return;
        }

        // Full navigation, not react-router: this leaves the app for Stripe.
        window.location.href = data.url as string;
      } catch (err) {
        console.error("continue-onboarding threw:", err);
        setError("Something went wrong opening Stripe payout setup. Please try again.");
      }
    };

    go();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 md:px-8 py-4">
        <a href="/" className="hover:opacity-80 transition-opacity">
          <Logo size="lg" />
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 md:px-6 pb-16">
        <div className="w-full max-w-md text-center">
          {!error ? (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              </div>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-2">
                Opening payout setup…
              </h1>
              <p className="text-body text-muted-foreground">
                Taking you to Stripe to finish setting up payouts.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-accent" />
              </div>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-2">
                Couldn't open Stripe
              </h1>
              <p className="text-body text-muted-foreground mb-8">{error}</p>
              <div className="space-y-3">
                <ButtonPrimary fullWidth onClick={() => window.location.reload()}>
                  Try again
                </ButtonPrimary>
                <ButtonSecondary fullWidth onClick={() => navigate("/publisher/settings/payout")}>
                  Go to payout settings
                </ButtonSecondary>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
