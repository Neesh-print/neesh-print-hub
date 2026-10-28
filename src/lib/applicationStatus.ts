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
