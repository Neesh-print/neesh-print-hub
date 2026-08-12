import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UseEmailVerificationReturn {
  /** null while loading, then whether the retailer's email is confirmed */
  isVerified: boolean | null;
  isResending: boolean;
  refetch: () => Promise<void>;
  /** Sends a fresh confirmation email. Resolves to true on success. */
  resend: () => Promise<boolean>;
}

/**
 * Instant-access signups can browse immediately but must confirm their email
 * (retailers.email_verified_at) before their first order. This hook reads that
 * flag and re-checks on window focus, so coming back from the email link in
 * another tab updates the checkout gate without a reload.
 */
export const useEmailVerification = (): UseEmailVerificationReturn => {
  const { user } = useAuth();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isResending, setIsResending] = useState(false);

  const refetch = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("retailers")
      .select("email_verified_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error) {
      setIsVerified(Boolean(data?.email_verified_at));
    }
  }, [user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  const resend = useCallback(async (): Promise<boolean> => {
    setIsResending(true);
    try {
      const { error } = await supabase.functions.invoke("verify-retailer-email", {
        body: { action: "resend", redirectUrl: window.location.origin },
      });
      return !error;
    } catch (err) {
      console.error("Error resending verification email:", err);
      return false;
    } finally {
      setIsResending(false);
    }
  }, []);

  return { isVerified, isResending, refetch, resend };
};
