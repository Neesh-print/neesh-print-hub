import { useNavigate } from "react-router-dom";
import { ArrowRight, Store } from "lucide-react";
import { ButtonPrimary } from "@/components/neesh";

interface StartSellingCardProps {
  // "locked" is shown in place of a marketplace page (orders, payouts,
  // shipping) for a publisher who doesn't sell on Neesh yet.
  variant?: "invite" | "locked";
}

// Claim-only publishers own their Index page but don't sell on Neesh. This
// card is how they opt in: it opens the application at the selling question
// with their page details already filled. Selling still goes through review.
export const StartSellingCard = ({ variant = "invite" }: StartSellingCardProps) => {
  const navigate = useNavigate();
  return (
    <div className="card-neesh border border-accent/30">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
        <div className="w-10 h-10 shrink-0 rounded-full bg-accent/10 flex items-center justify-center">
          <Store className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="font-display font-semibold text-heading text-foreground">
            {variant === "locked" ? "This is for publishers who sell on Neesh" : "Start selling on Neesh"}
          </h3>
          <p className="text-body text-muted-foreground">
            {variant === "locked"
              ? "Orders, payouts and shipping open up once you sell on Neesh. Your page on the Index works either way."
              : "Let shops, cafés and hotels order copies from you at the wholesale price you set. Neesh takes 10% of wholesale on each order. You ship, and you're paid through Stripe once the order ships."}
          </p>
          <p className="text-caption text-muted-foreground">
            Six short steps, then a person reviews it. Your page details are already filled in.
          </p>
          <div className="pt-2">
            <ButtonPrimary onClick={() => navigate("/apply/publisher?sell=1")} className="gap-2">
              Start selling
              <ArrowRight className="w-4 h-4" />
            </ButtonPrimary>
          </div>
        </div>
      </div>
    </div>
  );
};
