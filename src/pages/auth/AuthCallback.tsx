import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Only same-site paths, so a crafted link can't send someone elsewhere.
const safeNext = (value: string | null): string | null =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : null;

// Where email sign-in links land.
//   - Links we build ourselves (approval emails) carry ?token_hash=&type=,
//     verified here rather than by Supabase's /verify URL, so an email
//     scanner that pre-fetches links can't use up the one-time token.
//   - The standard "Email me a sign-in link" email comes back with the
//     session in the URL, which the Supabase client picks up on its own.
// Either way, ?next= (a path on this site) says where to go afterwards.
export const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const next = safeNext(searchParams.get("next"));
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    const finish = async () => {
      if (tokenHash) {
        // "magiclink" is what generateLink issues; newer auth servers also
        // accept "email" for the same token, so try that if the first fails.
        let { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type === "magiclink" ? "magiclink" : "email",
        });
        if (error && type === "magiclink") {
          ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" }));
        }
        if (error) {
          console.error("Sign-in link could not be verified:", error);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        navigate(next ?? "/home", { replace: true });
      } else if (tokenHash) {
        setFailed(true);
      } else {
        navigate("/login", { replace: true });
      }
    };
    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  if (failed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="font-display font-bold text-2xl text-foreground">That link has expired</h1>
          <p className="text-muted-foreground">
            Sign-in links work once, for an hour. Get a new one from the login page with only your email.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="text-accent underline underline-offset-2"
          >
            Go to the login page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      Signing you in...
    </div>
  );
};
