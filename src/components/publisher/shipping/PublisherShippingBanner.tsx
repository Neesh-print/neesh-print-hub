import { useNavigate } from "react-router-dom";
import { Truck } from "lucide-react";
import { ButtonPrimary } from "@/components/neesh";
import { useShippingV2 } from "@/hooks/useShippingV2";
import { usePublisherShipping } from "@/hooks/usePublisherShipping";
import { isQuotableAddress } from "@/lib/shipping";

/**
 * Dashboard banner (T4). With live rates as the default there are no Neesh
 * flat defaults, so a publisher without a ships-from address (and without
 * their own flat rates) cannot be checked out at all. Shown before launch too
 * (flag off), so publishers can set up shipping ahead of time.
 */
export const PublisherShippingBanner = ({ publisherId }: { publisherId: string | null | undefined }) => {
  const navigate = useNavigate();
  const { enabled, isLoading } = useShippingV2();
  const { data } = usePublisherShipping(publisherId, !!publisherId);
  if (isLoading || !data) return null;
  const hasAddress = isQuotableAddress({ ...data.ships_from_address, name: data.ships_from_address.name || "Publisher" });
  if (hasAddress || data.shipping_rate_mode === "flat") return null;

  return (
    <div className="px-4 md:px-6 pb-6">
      <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-accent/5 border border-accent/30">
        <div className="flex items-start gap-3">
          <Truck className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Add where you ship from</h3>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "Spaces pay shipping at checkout, quoted live from your address. Until you add it, spaces can't check out your titles."
                : "Spaces will soon pay shipping at checkout, quoted live from your address. Add it now so spaces can keep ordering your titles."}
            </p>
          </div>
        </div>
        <ButtonPrimary onClick={() => navigate("/publisher/settings")}>Set up shipping</ButtonPrimary>
      </div>
    </div>
  );
};
