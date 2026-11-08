import {
  publisherApplicationKind,
  publisherApplicationKindLabel,
  type PublisherApplicationKind,
} from "@/lib/applicationStatus";

const tone: Record<PublisherApplicationKind, string> = {
  claim_only: "border-border bg-muted text-foreground",
  claim_and_sell: "border-accent/40 bg-accent/10 text-accent",
  start_selling: "border-accent/40 bg-accent/10 text-accent",
};

// "Claim only" / "Claim and sell" / "Start selling" on publisher applications
// in the admin review queue.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ApplicationKindBadge = ({ data }: { data: Record<string, any> | null | undefined }) => {
  const kind = publisherApplicationKind(data);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${tone[kind]}`}
    >
      {publisherApplicationKindLabel[kind]}
    </span>
  );
};
