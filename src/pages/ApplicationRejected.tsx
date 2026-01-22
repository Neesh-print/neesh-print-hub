import { useNavigate } from "react-router-dom";
import { XCircle, Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { ButtonPrimary, ButtonSecondary, Logo } from "@/components/neesh";
import { useAuth } from "@/hooks/useAuth";

export const ApplicationRejected = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-4">
            Application Not Approved
          </h1>

          <p className="text-muted-foreground mb-6">
            Unfortunately, we weren't able to approve your application at this time. This could be
            due to incomplete information or your publication not meeting our current criteria.
          </p>

          <div className="bg-secondary/50 rounded-xl p-6 mb-8 text-left">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">We've sent you an email</p>
                <p className="text-sm text-muted-foreground">
                  Check <span className="font-medium text-foreground">{user?.email}</span> for more
                  details about why your application wasn't approved.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Think there's been a mistake or want to provide more information?
            </p>
            <a
              href="mailto:hi@neesh.art?subject=Application%20Review%20Request"
              className="inline-flex items-center gap-2 text-accent hover:underline"
            >
              Contact us to discuss your application
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row gap-3 justify-center">
            <ButtonSecondary onClick={() => navigate("/")} className="min-w-[160px]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </ButtonSecondary>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApplicationRejected;
