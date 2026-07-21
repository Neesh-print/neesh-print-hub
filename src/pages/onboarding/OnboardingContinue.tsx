import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ButtonPrimary, ButtonSecondary } from "@/components/neesh";

// Full-screen redirect page. On load it mints a fresh Stripe onboarding link
// via the continue-onboarding edge function and forwards the browser to it.
// This is also the refresh_url target, so an expired Stripe link lands back
// here and self-heals into a new one.
export const OnboardingContinue = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const startOnboarding = async () => {
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("continue-onboarding");

      if (fnError) {
        console.error("continue-onboarding failed:", fnError);
        setError("We could not open Stripe just now. Please try again.");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("We could not open Stripe just now. Please try again.");
      }
    } catch (e) {
      console.error("Error starting onboarding:", e);
      setError("We could not open Stripe just now. Please try again.");
    }
  };

  useEffect(() => {
    startOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {error ? (
          <div className="space-y-4">
            <h1 className="font-display font-semibold text-heading text-foreground">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <ButtonPrimary onClick={startOnboarding}>Try again</ButtonPrimary>
              <ButtonSecondary onClick={() => navigate("/publisher/settings/payout")}>
                Back to payout settings
              </ButtonSecondary>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Taking you to Stripe to continue setup…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingContinue;
