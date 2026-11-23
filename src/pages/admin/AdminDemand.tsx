import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, ExternalLink, Mail, RefreshCw, Store } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AdminLayout, StatCard } from "@/components/admin";
import {
  ButtonPrimary,
  ButtonSecondary,
  EmptyState,
  FormInput,
  FormSelect,
  FormTextarea,
  Modal,
  StatusBadge,
} from "@/components/neesh";
import type { StatusType } from "@/components/neesh/StatusBadge";
import { LoadingScreen } from "@/components/shared";
import { cn } from "@/lib/utils";
import {
  useDemandAction,
  useDemandQueue,
  type Confidence,
  type OutreachRow,
  type OutreachStatus,
  type RejectReason,
  type Suggestion,
  type SuggestionStatus,
} from "@/hooks/useDemandQueue";

// Demand queue (demand-signal spec, Automations 1 and 2). Suggestions: shop
// tips readers left on title pages, checked against the Index, Google Places
// and the shop's own site; approving lists the shop as a stockist. Publisher
// emails: drafts the daily job wrote for titles with reader or space demand.
// Nothing reaches a publisher until "Approve and send".

const INDEX_SITE = "https://neesh.art";

const CONFIDENCE_BADGE: Record<Confidence, { status: StatusType; label: string }> = {
  confirmed: { status: "received", label: "Confirmed" },
  likely: { status: "pending", label: "Likely" },
  unverified: { status: "cancelled", label: "Unverified" },
};

const SUGGESTION_BADGE: Record<SuggestionStatus, { status: StatusType; label: string }> = {
  new: { status: "pending", label: "New" },
  verifying: { status: "pending", label: "Checking" },
  needs_review: { status: "pending", label: "Needs review" },
  approved: { status: "received", label: "Approved" },
  rejected: { status: "cancelled", label: "Rejected" },
  duplicate: { status: "cancelled", label: "Duplicate" },
};

const OUTREACH_BADGE: Record<OutreachStatus, { status: StatusType; label: string }> = {
  draft: { status: "pending", label: "Draft" },
  approved: { status: "payment-pending", label: "Sending" },
  sent: { status: "received", label: "Sent" },
  skipped: { status: "cancelled", label: "Skipped" },
};

const TEMPLATE_LABEL: Record<string, string> = {
  A: "A · Not claimed",
  B: "B · Claimed, not selling",
  C: "C · Out of stock",
};

const REJECT_OPTIONS: { value: RejectReason; label: string }[] = [
  { value: "not_stocked", label: "Not stocked there" },
  { value: "closed", label: "Shop closed" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

type Tab = "suggestions" | "emails";

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

export const AdminDemand = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "emails" ? "emails" : "suggestions";
  const { data, isLoading, error, refetch } = useDemandQueue();

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Loading demand queue..." />
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="p-6">
          <EmptyState
            icon={<AlertCircle className="w-12 h-12" />}
            title="Something went wrong"
            description={errorText(error)}
            action={<ButtonPrimary onClick={() => refetch()}>Try again</ButtonPrimary>}
          />
        </div>
      </AdminLayout>
    );
  }

  const toReview = data.suggestions.filter((s) => ["new", "verifying", "needs_review"].includes(s.status));
  const drafts = data.outreach.filter((o) => o.status === "draft");

  return (
    <AdminLayout>
      <div className="px-4 md:px-6 pt-6 pb-4">
        <h1 className="font-display font-bold text-title text-foreground">Demand</h1>
        <p className="text-body text-muted-foreground mt-1">
          Shop suggestions from readers and publisher emails drafted from requests. Nothing is sent until you approve it.
        </p>
      </div>

      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Suggestions to review" value={toReview.length} />
          <StatCard label="Confirmed" value={toReview.filter((s) => s.confidence === "confirmed").length} />
          <StatCard label="Emails to approve" value={drafts.length} />
          <StatCard label="Emails sent" value={data.outreach.filter((o) => o.status === "sent").length} />
        </div>
      </div>

      <div className="px-4 md:px-6 pb-4">
        <div role="tablist" className="inline-flex rounded-lg border border-border p-1 gap-1">
          {(
            [
              ["suggestions", `Suggestions (${toReview.length})`],
              ["emails", `Publisher emails (${drafts.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setParams(key === "suggestions" ? {} : { tab: key }, { replace: true })}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors",
                tab === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "suggestions" ? (
        <SuggestionsTab suggestions={data.suggestions} toReview={toReview} />
      ) : (
        <EmailsTab outreach={data.outreach} />
      )}
    </AdminLayout>
  );
};

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

const SuggestionsTab = ({ suggestions, toReview }: { suggestions: Suggestion[]; toReview: Suggestion[] }) => {
  const action = useDemandAction();
  const [rejecting, setRejecting] = useState<Suggestion | null>(null);
  const [showDone, setShowDone] = useState(false);
  const confirmed = toReview.filter((s) => s.confidence === "confirmed");
  const decided = suggestions.filter((s) => !toReview.includes(s));

  const runVerify = () =>
    action.mutate(
      { action: "run_verify" },
      {
        onSuccess: (r) => toast.success(r.results?.length ? `Checked ${r.results.length}` : "No new suggestions to check"),
        onError: (e) => toast.error(errorText(e)),
      },
    );

  const approveConfirmed = () =>
    action.mutate(
      { action: "approve_confirmed" },
      {
        onSuccess: (r) => {
          toast.success(`Approved ${r.approved ?? 0}${r.revalidated ? "" : ". The Index updates on its next rebuild"}`);
          if (r.failed?.length) toast.error(`${r.failed.length} could not be approved: ${r.failed[0].error}`);
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );

  return (
    <section className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap gap-2 mb-4">
        <ButtonSecondary onClick={runVerify} loading={action.isPending && action.variables?.action === "run_verify"} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Check new now
        </ButtonSecondary>
        {confirmed.length > 0 && (
          <ButtonPrimary
            onClick={approveConfirmed}
            loading={action.isPending && action.variables?.action === "approve_confirmed"}
          >
            Approve all confirmed ({confirmed.length})
          </ButtonPrimary>
        )}
      </div>

      {toReview.length === 0 ? (
        <div className="card-neesh">
          <EmptyState
            icon={<CheckCircle2 className="w-12 h-12" />}
            title="No suggestions to review"
            description="New shop suggestions are checked every 15 minutes and land here."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {toReview.map((s) => (
            <SuggestionCard key={s.id} s={s} onReject={() => setRejecting(s)} />
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {showDone ? "Hide" : "Show"} decided in the last 90 days ({decided.length})
          </button>
          {showDone && (
            <div className="card-neesh divide-y divide-border mt-3">
              {decided.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0 text-body">
                  <span className="font-semibold text-foreground">{s.shop_name}</span>
                  <span className="text-muted-foreground">
                    {s.city} · {s.title?.name ?? "Unknown title"}
                  </span>
                  <StatusBadge status={SUGGESTION_BADGE[s.status].status} label={SUGGESTION_BADGE[s.status].label} />
                  {s.reject_reason && (
                    <span className="text-caption text-muted-foreground">
                      {REJECT_OPTIONS.find((o) => o.value === s.reject_reason)?.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rejecting && <RejectModal s={rejecting} onClose={() => setRejecting(null)} />}
    </section>
  );
};

const EvidenceLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-caption text-accent hover:underline break-all"
  >
    <ExternalLink className="w-3 h-3 shrink-0" />
    {children}
  </a>
);

const SuggestionCard = ({ s, onReject }: { s: Suggestion; onReject: () => void }) => {
  const action = useDemandAction();
  const ev = s.evidence ?? {};
  const busy = action.isPending;
  const canApprove = s.status === "needs_review" && (!!ev.store || !!ev.place?.country);
  const badge = s.confidence ? CONFIDENCE_BADGE[s.confidence] : SUGGESTION_BADGE[s.status];

  const approve = () =>
    action.mutate(
      { action: "approve_suggestion", id: s.id },
      {
        onSuccess: (r) =>
          toast.success(
            r.revalidated
              ? `${s.shop_name} is listed for ${s.title?.name}`
              : `${s.shop_name} is listed. The Index updates on its next rebuild`,
          ),
        onError: (e) => toast.error(errorText(e)),
      },
    );

  const reverify = () =>
    action.mutate(
      { action: "reverify_suggestion", id: s.id },
      { onSuccess: () => toast.success("Checked again"), onError: (e) => toast.error(errorText(e)) },
    );

  return (
    <div className="card-neesh">
      <div className="flex flex-wrap items-center gap-2">
        <Store className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="font-display font-semibold text-body text-foreground">{s.shop_name}</span>
        <span className="text-body text-muted-foreground">{s.city}</span>
        <StatusBadge status={badge.status} label={badge.label} />
        {s.title?.available_on_neesh && (
          <span className="px-2 py-0.5 rounded-full text-caption bg-secondary text-foreground">Sells on Neesh</span>
        )}
      </div>

      <p className="text-caption text-muted-foreground mt-1">
        For{" "}
        {s.title ? (
          <a href={`${INDEX_SITE}/titles/${s.title.slug}`} target="_blank" rel="noopener noreferrer" className="underline">
            {s.title.name}
          </a>
        ) : (
          "an unknown title"
        )}{" "}
        · Suggested {format(new Date(s.created_at), "MMM d, yyyy")}
        {s.email && <> · by {s.email}</>}
      </p>

      <div className="mt-3 rounded-lg bg-secondary/60 p-3 space-y-1.5 text-caption text-foreground">
        {ev.store ? (
          <p>
            On the Index as{" "}
            <a href={`${INDEX_SITE}/stores/${ev.store.slug}`} target="_blank" rel="noopener noreferrer" className="underline">
              {ev.store.name}
            </a>
            {ev.store.city ? `, ${ev.store.city}` : ""}
          </p>
        ) : ev.place ? (
          <p>
            New store from Google Places: {ev.place.name}
            {ev.place.address ? `, ${ev.place.address}` : ""} <EvidenceLink href={ev.place.maps_url}>Map</EvidenceLink>
          </p>
        ) : (
          <p className="text-muted-foreground">
            No matching shop found{ev.places_note ? ` (${ev.places_note})` : ""}.
          </p>
        )}
        {ev.title_hit ? (
          <p>
            Title found on their site: <span className="italic">&ldquo;{ev.title_hit.snippet}&rdquo;</span>{" "}
            <EvidenceLink href={ev.title_hit.url}>Page</EvidenceLink>
          </p>
        ) : ev.website ? (
          <p className="text-muted-foreground">
            Title not found on <EvidenceLink href={ev.website}>{ev.website.replace(/^https?:\/\//, "")}</EvidenceLink>
          </p>
        ) : null}
        {ev.error && <p className="text-destructive">Check failed: {ev.error}</p>}
        {!canApprove && s.status === "needs_review" && (
          <p className="text-muted-foreground">
            Can't approve yet: the shop's country is unknown. Check again, or add the store on the Index first.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <ButtonPrimary onClick={approve} disabled={!canApprove || busy} loading={busy && action.variables?.action === "approve_suggestion"} className="text-caption py-1 px-3">
          Approve
        </ButtonPrimary>
        <ButtonSecondary onClick={onReject} disabled={busy} destructive className="text-caption py-1 px-3">
          Reject
        </ButtonSecondary>
        <ButtonSecondary onClick={reverify} disabled={busy} loading={busy && action.variables?.action === "reverify_suggestion"} className="text-caption py-1 px-3">
          Check again
        </ButtonSecondary>
      </div>
    </div>
  );
};

const RejectModal = ({ s, onClose }: { s: Suggestion; onClose: () => void }) => {
  const action = useDemandAction();
  const [reason, setReason] = useState<RejectReason>("not_stocked");
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Reject suggestion"
      preventClose={action.isPending}
      footer={
        <>
          <ButtonSecondary onClick={onClose} disabled={action.isPending}>
            Cancel
          </ButtonSecondary>
          <ButtonPrimary
            loading={action.isPending}
            onClick={() =>
              action.mutate(
                { action: "reject_suggestion", id: s.id, reason },
                {
                  onSuccess: () => {
                    toast.success("Rejected");
                    onClose();
                  },
                  onError: (e) => toast.error(errorText(e)),
                },
              )
            }
          >
            Reject
          </ButtonPrimary>
        </>
      }
    >
      <p className="text-body text-foreground mb-4">
        {s.shop_name}, {s.city} · {s.title?.name}
      </p>
      <FormSelect label="Reason" options={REJECT_OPTIONS} value={reason} onChange={(v) => setReason(v as RejectReason)} />
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Publisher emails
// ---------------------------------------------------------------------------

const EmailsTab = ({ outreach }: { outreach: OutreachRow[] }) => {
  const action = useDemandAction();
  const [open, setOpen] = useState<OutreachRow | null>(null);
  const drafts = outreach.filter((o) => o.status === "draft" || o.status === "approved");
  const history = outreach.filter((o) => o.status === "sent" || o.status === "skipped");

  const runDrafts = () =>
    action.mutate(
      { action: "run_drafts" },
      {
        onSuccess: (r) => {
          const n = r.drafted?.length ?? 0;
          const missing = r.needsContact?.length ?? 0;
          toast.success(
            `${n === 0 ? "No new drafts" : `${n} new draft${n === 1 ? "" : "s"}`}` +
              (missing ? `. ${missing} title${missing === 1 ? " needs" : "s need"} a publisher email: ${r.needsContact!.join(", ")}` : ""),
          );
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );

  return (
    <section className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <ButtonSecondary onClick={runDrafts} loading={action.isPending} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Draft now
        </ButtonSecondary>
        <p className="text-caption text-muted-foreground">
          Drafts are written daily at 10am ET for titles with 2+ reader or 1+ space requests in 30 days.
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="card-neesh">
          <EmptyState
            icon={<Mail className="w-12 h-12" />}
            title="No emails waiting"
            description="When a title crosses the demand threshold, its publisher email shows up here as a draft."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((o) => (
            <OutreachCard key={o.id} o={o} onOpen={() => setOpen(o)} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display font-semibold text-heading text-foreground mb-3">History</h2>
          <div className="card-neesh divide-y divide-border">
            {history.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0 text-body">
                <StatusBadge status={OUTREACH_BADGE[o.status].status} label={OUTREACH_BADGE[o.status].label} />
                <span className="font-semibold text-foreground">{o.title?.name ?? o.recipient_email}</span>
                <span className="text-muted-foreground">
                  {TEMPLATE_LABEL[o.template] ?? o.template} · {o.recipient_email}
                </span>
                <span className="text-caption text-muted-foreground">
                  {o.sent_at ? format(new Date(o.sent_at), "MMM d, yyyy") : o.skip_reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && <DraftModal key={open.id} o={open} onClose={() => setOpen(null)} />}
    </section>
  );
};

const OutreachCard = ({ o, onOpen }: { o: OutreachRow; onOpen: () => void }) => (
  <div className="card-neesh">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-display font-semibold text-body text-foreground">{o.title?.name ?? "Untitled"}</span>
      <StatusBadge status={OUTREACH_BADGE[o.status].status} label={OUTREACH_BADGE[o.status].label} />
      <span className="px-2 py-0.5 rounded-full text-caption bg-secondary text-foreground">
        {TEMPLATE_LABEL[o.template] ?? o.template}
      </span>
    </div>
    <p className="text-caption text-muted-foreground mt-1">
      To {o.publisher?.name ? `${o.publisher.name}, ` : ""}
      {o.recipient_email} · {o.demand_signal_ids.length} request{o.demand_signal_ids.length === 1 ? "" : "s"} · Drafted{" "}
      {format(new Date(o.created_at), "MMM d")}
    </p>
    <p className="text-body text-foreground mt-2 font-semibold">{o.subject}</p>
    <p className="text-caption text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{o.body}</p>
    <div className="flex flex-wrap gap-2 mt-3">
      <ButtonPrimary onClick={onOpen} disabled={o.status !== "draft"} className="text-caption py-1 px-3">
        Review and send
      </ButtonPrimary>
    </div>
  </div>
);

const DraftModal = ({ o, onClose }: { o: OutreachRow; onClose: () => void }) => {
  const action = useDemandAction();
  const [subject, setSubject] = useState(o.subject ?? "");
  const [body, setBody] = useState(o.body ?? "");
  const [skipReason, setSkipReason] = useState("");
  const [skipping, setSkipping] = useState(false);
  const dirty = subject !== (o.subject ?? "") || body !== (o.body ?? "");
  const hasDash = useMemo(() => /—/.test(subject + body), [subject, body]);
  const busy = action.isPending;

  const save = async () => {
    if (!dirty) return;
    await action.mutateAsync({ action: "update_draft", id: o.id, subject, body });
  };

  const send = async () => {
    try {
      await save();
      await action.mutateAsync({ action: "send_outreach", id: o.id });
      toast.success(`Sent to ${o.recipient_email}`);
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const skip = () =>
    action.mutate(
      { action: "skip_outreach", id: o.id, reason: skipReason },
      {
        onSuccess: () => {
          toast.success("Skipped");
          onClose();
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );

  const saveOnly = async () => {
    try {
      await save();
      toast.success("Draft saved");
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Modal
      isOpen
      size="lg"
      onClose={onClose}
      title={skipping ? "Skip this email" : "Review publisher email"}
      preventClose={busy}
      footer={
        skipping ? (
          <>
            <ButtonSecondary onClick={() => setSkipping(false)} disabled={busy}>
              Back
            </ButtonSecondary>
            <ButtonPrimary onClick={skip} loading={busy}>
              Skip
            </ButtonPrimary>
          </>
        ) : (
          <>
            <ButtonSecondary onClick={() => setSkipping(true)} disabled={busy} destructive>
              Skip
            </ButtonSecondary>
            {dirty && (
              <ButtonSecondary onClick={saveOnly} disabled={busy}>
                Save draft
              </ButtonSecondary>
            )}
            <ButtonPrimary onClick={send} loading={busy} disabled={hasDash || !subject.trim() || !body.trim()}>
              Approve and send
            </ButtonPrimary>
          </>
        )
      }
    >
      {skipping ? (
        <FormInput
          label="Why skip? (optional)"
          placeholder="Already talking to them, distributor only..."
          value={skipReason}
          onChange={setSkipReason}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-caption text-muted-foreground">
            From Gem &lt;gem@neesh.art&gt; to {o.recipient_email} · {TEMPLATE_LABEL[o.template] ?? o.template}. Sent as plain
            text through Resend. Counts toward this publisher's 2-email limit.
          </p>
          <FormInput label="Subject" value={subject} onChange={setSubject} />
          <FormTextarea label="Body" value={body} onChange={setBody} rows={14} className="font-mono text-sm" />
          {hasDash && <p className="text-caption text-destructive">Remove the em dash before sending.</p>}
        </div>
      )}
    </Modal>
  );
};
