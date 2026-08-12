import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, MailX, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth";
import { ButtonPrimary } from "@/components/neesh/ButtonPrimary";
import { supabase } from "@/integrations/supabase/client";

type VerifyState = "verifying" | "success" | "error";

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerifyState>("verifying");
  const hasRun = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-invocation: the token is single-use, so
    // a second call would land after the first already cleared it.
    if (hasRun.current) return;
    hasRun.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      return;
    }

    supabase.functions
      .invoke("verify-retailer-email", { body: { action: "verify", token } })
      .then(({ error }) => setState(error ? "error" : "success"))
      .catch(() => setState("error"));
  }, [searchParams]);

  return (
    <AuthLayout>
      <div className="text-center py-8">
        {state === "verifying" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
            <h1 className="font-display font-bold text-display text-foreground mb-2">
              Confirming your email…
            </h1>
            <p className="text-body text-text-secondary">This only takes a second.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
              <MailCheck className="w-8 h-8 text-accent" />
            </div>
            <h1 className="font-display font-bold text-display text-foreground mb-2">
              Email confirmed
            </h1>
            <p className="text-body text-text-secondary mb-8">
              You're all set to place orders on Neesh.
            </p>
            <ButtonPrimary fullWidth onClick={() => navigate("/retailer")}>
              Go to the catalog
            </ButtonPrimary>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
              <MailX className="w-8 h-8 text-accent" />
            </div>
            <h1 className="font-display font-bold text-display text-foreground mb-2">
              This link didn't work
            </h1>
            <p className="text-body text-text-secondary mb-8">
              It may have expired or already been used. If your email still needs
              confirming, you can resend the link from checkout.
            </p>
            <ButtonPrimary fullWidth onClick={() => navigate("/retailer")}>
              Back to the catalog
            </ButtonPrimary>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
