import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ExternalLink, ImageOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AdminLayout, StatCard } from "@/components/admin";
import {
  BackNavigation,
  StatusBadge,
  ButtonPrimary,
  ButtonSecondary,
  FormInput,
  FormSelect,
  FormTextarea,
  EmptyState,
  Modal,
} from "@/components/neesh";
import type { StatusType } from "@/components/neesh/StatusBadge";
import { LoadingScreen } from "@/components/shared";
import {
  useIndexReviewQueue,
  useReviewRecord,
  useMergeRecord,
  useIssueToVariant,
  useSetCoverage,
  useAllowAdding,
  searchMergeTargets,
  type QueueItem,
  type ReviewKind,
  type ReviewStatus,
  type ReportReason,
  type CatalogueCoverage,
  type VariantKind,
} from "@/hooks/useIndexReview";

type Action = "approve" | "reject" | "flag" | "merge" | "variant";

const KIND_SECTIONS: { kind: ReviewKind; label: string }[] = [
  { kind: "issue", label: "Issues" },
  { kind: "title", label: "Titles" },
  { kind: "publisher", label: "Publishers" },
  { kind: "variant", label: "Variants" },
];

// Review states reuse the existing badge colours: pending amber, flagged
// orange, approved green, rejected grey.
const STATUS_BADGE: Record<ReviewStatus, { status: StatusType; label: string }> = {
  pending: { status: "pending", label: "Pending" },
  flagged: { status: "payment-pending", label: "Flagged" },
  approved: { status: "received", label: "Approved" },
  rejected: { status: "cancelled", label: "Rejected" },
};

const REASON_LABEL: Record<ReportReason, string> = {
  inaccurate: "Inaccurate",
  duplicate: "Duplicate",
  offensive: "Offensive",
  other: "Other",
};

const COVERAGE_OPTIONS = [
  { value: "complete", label: "Complete" },
  { value: "partial", label: "Partial" },
  { value: "unknown", label: "Unknown" },
];

const VARIANT_OPTIONS = [
  { value: "alternate_cover", label: "Alternate cover" },
  { value: "edition", label: "Edition" },
  { value: "supplement", label: "Supplement" },
];

const ACTION_TITLE: Record<Action, string> = {
  approve: "Approve",
  reject: "Reject",
  flag: "Flag",
  merge: "Merge into...",
  variant: "Is a variant of...",
};

export const AdminIndexReview = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useIndexReviewQueue();
  const setCoverage = useSetCoverage();
  const [active, setActive] = useState<{ action: Action; item: QueueItem } | null>(null);

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Loading review queue..." />
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
            description={error instanceof Error ? error.message : "Failed to load the review queue"}
            action={<ButtonPrimary onClick={() => refetch()}>Try Again</ButtonPrimary>}
          />
        </div>
      </AdminLayout>
    );
  }

  const handleCoverage = (titleId: string, coverage: string) => {
    setCoverage.mutate(
      { titleId, coverage: coverage as CatalogueCoverage },
      {
        onSuccess: () => toast.success("Coverage updated"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update coverage"),
      },
    );
  };

  const countOf = (kind: ReviewKind) => data.items.filter((i) => i.kind === kind).length;

  return (
    <AdminLayout>
      <BackNavigation title="Index review" onBack={() => navigate("/admin/magazines")} />

      {/* Stats Row — one count per kind */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KIND_SECTIONS.map((s) => (
            <StatCard key={s.kind} label={s.label} value={countOf(s.kind)} />
          ))}
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh">
            <EmptyState
              icon={<CheckCircle2 className="w-12 h-12" />}
              title="Nothing to review"
              description="No pending, flagged or reported records."
            />
          </div>
        </div>
      ) : (
        KIND_SECTIONS.filter((s) => countOf(s.kind) > 0).map((s) => (
          <section key={s.kind} className="px-4 md:px-6 pb-6">
            <h2 className="font-display font-semibold text-heading text-foreground mb-3">
              {s.label} <span className="text-muted-foreground">({countOf(s.kind)})</span>
            </h2>
            <div className="space-y-3">
              {data.items
                .filter((i) => i.kind === s.kind)
                .map((item) => (
                  <ReviewCard
                    key={item.id}
                    item={item}
                    onAction={(action) => setActive({ action, item })}
                  />
                ))}
            </div>
          </section>
        ))
      )}

      {/* Coverage — titles whose issue list changed */}
      {data.coverageTitles.length > 0 && (
        <section className="px-4 md:px-6 pb-8">
          <h2 className="font-display font-semibold text-heading text-foreground mb-3">
            Coverage
          </h2>
          <div className="card-neesh divide-y divide-border">
            {data.coverageTitles.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-body text-foreground">{t.name}</span>
                <FormSelect
                  aria-label={`Coverage for ${t.name}`}
                  options={COVERAGE_OPTIONS}
                  value={t.catalogue_coverage}
                  onChange={(value) => handleCoverage(t.id, value)}
                  disabled={setCoverage.isPending}
                  className="sm:w-40"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {active && (
        <ActionModal
          key={`${active.action}-${active.item.id}`}
          action={active.action}
          item={active.item}
          onClose={() => setActive(null)}
        />
      )}
    </AdminLayout>
  );
};

const ReviewCard = ({
  item,
  onAction,
}: {
  item: QueueItem;
  onAction: (action: Action) => void;
}) => {
  const allowAdding = useAllowAdding();
  const badge = STATUS_BADGE[item.review_status];
  const canMerge = item.kind === "issue" || item.kind === "title";

  return (
    <div className="card-neesh flex gap-3">
      {/* Cover thumbnail */}
      <div className="w-12 h-16 shrink-0 rounded bg-secondary overflow-hidden flex items-center justify-center">
        {item.coverUrl ? (
          <img src={item.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <ImageOff className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display font-semibold text-body text-foreground break-words">
            {item.label}
          </span>
          <StatusBadge status={badge.status} label={badge.label} />
          {item.created_from === "reader_created" && (
            <span className="px-2 py-0.5 rounded-full text-caption bg-secondary text-foreground">
              Reader-added
            </span>
          )}
          {item.addingPaused && (
            <span className="px-2 py-0.5 rounded-full text-caption bg-secondary text-destructive">
              Adding paused
            </span>
          )}
        </div>

        <p className="text-caption text-muted-foreground mt-0.5">
          {item.parentName || "No parent"} · Added{" "}
          {format(new Date(item.created_at), "MMM d, yyyy")}
        </p>

        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-caption text-accent hover:underline mt-1 break-all"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            {item.source_url}
          </a>
        )}

        {/* Open reports */}
        {item.open_reports > 0 && (
          <div className="mt-2 text-caption">
            <p className="font-medium text-destructive">
              {item.open_reports} open report{item.open_reports !== 1 ? "s" : ""}
            </p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {item.reports.map((r) => (
                <li key={r.id}>
                  {REASON_LABEL[r.reason]}
                  {r.note ? `: ${r.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {item.addingPaused && item.created_by && (
            <ButtonSecondary
              onClick={() =>
                allowAdding.mutate(item.created_by as string, {
                  onSuccess: () => toast.success("Reader can add again"),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Could not update reader"),
                })
              }
              loading={allowAdding.isPending}
              className="text-caption py-1 px-3"
            >
              Let them add again
            </ButtonSecondary>
          )}
          <ButtonPrimary onClick={() => onAction("approve")} className="text-caption py-1 px-3">
            Approve
          </ButtonPrimary>
          <ButtonSecondary onClick={() => onAction("reject")} destructive className="text-caption py-1 px-3">
            Reject
          </ButtonSecondary>
          {item.review_status !== "flagged" && (
            <ButtonSecondary onClick={() => onAction("flag")} className="text-caption py-1 px-3">
              Flag
            </ButtonSecondary>
          )}
          {canMerge && (
            <ButtonSecondary onClick={() => onAction("merge")} className="text-caption py-1 px-3">
              Merge into...
            </ButtonSecondary>
          )}
          {item.kind === "issue" && (
            <ButtonSecondary onClick={() => onAction("variant")} className="text-caption py-1 px-3">
              Is a variant of...
            </ButtonSecondary>
          )}
        </div>
      </div>
    </div>
  );
};

const ActionModal = ({
  action,
  item,
  onClose,
}: {
  action: Action;
  item: QueueItem;
  onClose: () => void;
}) => {
  const review = useReviewRecord();
  const merge = useMergeRecord();
  const toVariant = useIssueToVariant();
  const [note, setNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [term, setTerm] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [variantKind, setVariantKind] = useState<VariantKind>("alternate_cover");
  const [variantLabel, setVariantLabel] = useState("");

  const picking = action === "merge" || action === "variant";
  // Titles need a search term; issues on one title are few enough to list.
  const canSearch = picking && (item.kind === "issue" || term.trim().length >= 2);
  const targets = useQuery({
    queryKey: ["index-review-targets", item.kind, item.id, term.trim()],
    queryFn: () => searchMergeTargets(item, term),
    enabled: canSearch,
  });
  const target = targets.data?.find((t) => t.id === targetId);

  const isPending = review.isPending || merge.isPending || toVariant.isPending;
  const done = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      onClose();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  const handleConfirm = () => {
    if (action === "approve" || action === "reject" || action === "flag") {
      const status: ReviewStatus =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "flagged";
      review.mutate(
        {
          kind: item.kind,
          id: item.id,
          status,
          note: action === "approve" ? undefined : note.trim(),
          sourceUrl: action === "approve" ? sourceUrl.trim() : undefined,
          coverPath: item.cover_image_path,
        },
        done(action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Flagged"),
      );
    } else if (action === "merge" && targetId && (item.kind === "issue" || item.kind === "title")) {
      merge.mutate({ kind: item.kind, fromId: item.id, intoId: targetId }, done("Merged"));
    } else if (action === "variant" && targetId) {
      toVariant.mutate(
        { issueId: item.id, parentId: targetId, kind: variantKind, label: variantLabel.trim() },
        done("Moved to variant"),
      );
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={ACTION_TITLE[action]}
      preventClose={isPending}
      footer={
        <>
          <ButtonSecondary onClick={onClose} disabled={isPending}>
            Cancel
          </ButtonSecondary>
          <ButtonPrimary
            onClick={handleConfirm}
            loading={isPending}
            disabled={picking && !targetId}
          >
            {action === "merge" ? "Merge" : action === "variant" ? "Move" : ACTION_TITLE[action]}
          </ButtonPrimary>
        </>
      }
    >
      <p className="text-body text-foreground mb-4">
        {item.label}
        {item.parentName && <span className="text-muted-foreground"> · {item.parentName}</span>}
      </p>

      {action === "approve" && (
        <FormInput
          label="Source URL (optional)"
          placeholder={item.source_url || "https://"}
          value={sourceUrl}
          onChange={setSourceUrl}
          type="url"
        />
      )}

      {(action === "reject" || action === "flag") && (
        <FormTextarea
          label="Note"
          placeholder={action === "reject" ? "Why it was rejected" : "What needs checking"}
          value={note}
          onChange={setNote}
          rows={3}
        />
      )}

      {picking && (
        <div className="space-y-3">
          {action === "variant" && (
            <FormSelect
              label="Kind"
              options={VARIANT_OPTIONS}
              value={variantKind}
              onChange={(value) => setVariantKind(value as VariantKind)}
            />
          )}
          <FormInput
            label={item.kind === "title" ? "Search titles" : "Search issues on this title"}
            placeholder={item.kind === "title" ? "Title name" : "Issue label"}
            value={term}
            onChange={(value) => {
              setTerm(value);
              setTargetId(null);
            }}
          />
          {targets.isFetching ? (
            <p className="text-caption text-muted-foreground">Searching...</p>
          ) : targets.data && targets.data.length > 0 ? (
            <ul className="border border-border rounded-lg divide-y divide-border">
              {targets.data.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setTargetId(t.id)}
                    className={`w-full text-left px-3 py-2 text-body transition-colors ${
                      t.id === targetId ? "bg-secondary font-medium" : "hover:bg-secondary/50"
                    }`}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : canSearch ? (
            <p className="text-caption text-muted-foreground">No matches.</p>
          ) : null}
          {action === "variant" && (
            <FormInput
              label="Variant label (optional)"
              placeholder={item.label}
              value={variantLabel}
              onChange={setVariantLabel}
            />
          )}
          {target && (
            <p className="text-caption text-muted-foreground">
              {action === "merge"
                ? `"${item.label}" will be merged into "${target.label}". Reader marks and history move over. This cannot be undone.`
                : `"${item.label}" will become a variant of "${target.label}".`}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};
