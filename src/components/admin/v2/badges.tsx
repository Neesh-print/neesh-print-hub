import { cn } from "@/lib/utils";
import { PAYOUT_LABEL, STAGE_LABEL, type OrderStage, type PayoutState } from "@/lib/adminOverview";

const TONE = {
  neutral: "bg-status-neutral text-status-neutral-text",
  pending: "bg-status-pending text-status-pending-text",
  success: "bg-status-success text-status-success-text",
  error: "bg-status-error text-status-error-text",
  accent: "bg-accent/10 text-accent",
} as const;

export type BadgeTone = keyof typeof TONE;

export const Badge = ({ tone, children, className }: { tone: BadgeTone; children: React.ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-block whitespace-nowrap rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
      TONE[tone],
      className,
    )}
  >
    {children}
  </span>
);

const STAGE_TONE: Record<OrderStage, BadgeTone> = {
  unpaid: "neutral",
  to_ship: "accent",
  packed: "pending",
  shipped: "neutral",
  delivered: "success",
  returned: "neutral",
  cancelled: "neutral",
};

const PAYOUT_TONE: Record<PayoutState, BadgeTone> = {
  none: "neutral",
  waiting: "neutral",
  ready: "success",
  blocked: "pending",
  held: "pending",
  sending: "neutral",
  paid_out: "success",
  failed: "error",
  cancelled: "neutral",
};

export const StageBadge = ({ stage }: { stage: OrderStage }) => <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;

export const PayoutBadge = ({ state }: { state: PayoutState }) => <Badge tone={PAYOUT_TONE[state]}>{PAYOUT_LABEL[state]}</Badge>;
