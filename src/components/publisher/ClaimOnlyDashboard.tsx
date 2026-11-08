import { useNavigate } from "react-router-dom";
import { Globe, MessageSquare, ArrowRight } from "lucide-react";
import { BackNavigation, ButtonSecondary } from "@/components/neesh";
import { PublisherLayout } from "./PublisherLayout";
import { StartSellingCard } from "./StartSellingCard";

// Dashboard for a publisher who claimed their Index page without selling.
// Nothing here is about orders or payouts.
export const ClaimOnlyDashboard = ({ companyName }: { companyName?: string | null }) => {
  const navigate = useNavigate();
  return (
    <PublisherLayout>
      <BackNavigation title="Overview" onBack={() => navigate("/")} />
      <div className="px-4 md:px-6 pb-8 space-y-6 max-w-3xl">
        <div className="card-neesh space-y-3">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-accent" />
            <h2 className="font-display font-semibold text-heading text-foreground">
              {companyName ? `${companyName} on the Neesh Index` : "Your page on the Neesh Index"}
            </h2>
          </div>
          <p className="text-body text-muted-foreground">
            Your page is yours. Keep the description, cover, links and issues up to date, and see
            who&rsquo;s looking.
          </p>
          <ButtonSecondary onClick={() => navigate("/publisher/index-listing")} className="gap-2">
            Edit your page
            <ArrowRight className="w-4 h-4" />
          </ButtonSecondary>
        </div>

        <StartSellingCard />

        <div className="card-neesh flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <p className="text-body text-foreground">Messages from spaces and readers</p>
          </div>
          <ButtonSecondary onClick={() => navigate("/publisher/messages")}>Open</ButtonSecondary>
        </div>
      </div>
    </PublisherLayout>
  );
};
