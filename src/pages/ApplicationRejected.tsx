import { useNavigate } from "react-router-dom";
import { ButtonSecondary, Logo } from "@/components/neesh";
import { useAuth } from "@/hooks/useAuth";

// v2 "Application not approved" screen: honest about timing and fit, lists
// the usual reasons, and keeps the door open — apply again with the next
// issue, or argue the call by email.
const SITE = "https://neesh.art";

export const ApplicationRejected = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <Logo size="lg" />
          </a>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground mb-3">
            Application reviewed
          </p>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Not this time — but not never.
          </h1>

          <p className="text-muted-foreground mb-6">
            We read every application by hand, and yours isn&rsquo;t a fit for the index yet.
            That&rsquo;s a judgement about timing and fit, not about your magazine.
          </p>

          <div className="bg-[#EFEEF6] rounded-lg p-6 mb-6 text-left">
            <p className="font-medium text-foreground mb-3">The usual reasons</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>No issue out yet, or none we could get hold of</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Not enough copies on hand to fill wholesale orders</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Already distributed exclusively somewhere else</span>
              </li>
            </ul>
          </div>

          <p className="text-foreground mb-8">
            Apply again when your next issue lands — we keep your application on file, so
            it&rsquo;s a shorter form the second time. If you think we&rsquo;ve got this wrong,{" "}
            <a
              href="mailto:hi@neesh.art?subject=Application%20Review%20Request"
              className="text-accent underline underline-offset-4 hover:text-foreground"
            >
              tell us why
            </a>
            . We do change our minds.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`${SITE}/index`}
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-primary text-primary-foreground font-display font-semibold hover:bg-accent transition-colors"
            >
              Browse the index
            </a>
            <ButtonSecondary onClick={() => window.location.assign(`${SITE}/newsletter`)}>
              Get the newsletter
            </ButtonSecondary>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApplicationRejected;
