import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PublisherLayout } from "./PublisherLayout";
import { StartSellingCard } from "./StartSellingCard";

// Wraps the marketplace pages of the publisher portal (orders, titles for
// sale, payouts, transfers, Stripe onboarding). A claim-only publisher sees
// the Start selling card instead. Admins and sellers pass straight through.
export const SellerOnly = ({ children }: { children: ReactNode }) => {
  const { userRole, publisherStatus } = useAuth();
  if (userRole === "publisher" && publisherStatus && !publisherStatus.sellsOnNeesh) {
    return (
      <PublisherLayout>
        <div className="px-4 md:px-6 py-6 max-w-2xl">
          <StartSellingCard variant="locked" />
        </div>
      </PublisherLayout>
    );
  }
  return <>{children}</>;
};
