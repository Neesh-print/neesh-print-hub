import type { StatusType } from "@/components/neesh/StatusBadge";

/**
 * Badge for a normalized application status (see ApplicationStatus in
 * src/hooks/useApplications.ts). Applications have their own labels; they
 * must not reuse order labels like RECEIVED or UNFULFILLED.
 */
const applicationStatusDisplay: Record<string, { status: StatusType; label: string }> = {
  draft: { status: "payment-not-sent", label: "DRAFT" },
  pending: { status: "pending", label: "PENDING REVIEW" },
  approved: { status: "paid", label: "APPROVED" },
  rejected: { status: "cancelled", label: "DECLINED" },
  on_hold: { status: "new-order", label: "ON HOLD" },
  waitlisted: { status: "new-order", label: "WAITLISTED" },
};

export const applicationStatusBadge = (status: string | null | undefined): { status: StatusType; label: string } =>
  applicationStatusDisplay[status ?? ""] ?? { status: "pending", label: (status || "UNKNOWN").toUpperCase() };

/**
 * What a publisher application asks for (claim-without-selling spec):
 *   - claim_only:    "Not right now, just claim my page". Lighter review:
 *                    confirm they really are the publisher. No product review.
 *   - claim_and_sell: chose to sell. Applications from before the selling
 *                    question existed all went through the selling steps.
 *   - start_selling: a claim-only publisher applying to sell from their
 *                    dashboard.
 */
export type PublisherApplicationKind = "claim_only" | "claim_and_sell" | "start_selling";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const publisherApplicationKind = (row: Record<string, any> | null | undefined): PublisherApplicationKind => {
  const info = (row?.additional_info ?? {}) as Record<string, unknown>;
  const wantsToSell = typeof row?.wants_to_sell === "boolean"
    ? row.wants_to_sell
    : typeof info.wantsToSell === "boolean"
      ? info.wantsToSell
      : true;
  if (!wantsToSell) return "claim_only";
  if (info.sellUpgrade) return "start_selling";
  return "claim_and_sell";
};

export const publisherApplicationKindLabel: Record<PublisherApplicationKind, string> = {
  claim_only: "Claim only",
  claim_and_sell: "Claim and sell",
  start_selling: "Start selling",
};
