import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Hand-written types until the collections migration is applied and the
// generated types are refreshed. Uses the existing authenticated client.
const db = supabase as unknown as SupabaseClient;
const rpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

async function call(name: string, args?: Record<string, unknown>) {
  const result = await rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export type ReviewKind = "issue" | "title" | "publisher" | "variant";
export type ReviewStatus = "approved" | "pending" | "flagged" | "rejected";
export type Provenance =
  | "imported"
  | "publisher_created"
  | "admin_created"
  | "reader_created";
export type CatalogueCoverage = "complete" | "partial" | "unknown";
export type VariantKind = "alternate_cover" | "edition" | "supplement";
export type ReportReason = "inaccurate" | "duplicate" | "offensive" | "other";

export interface QueueRow {
  kind: ReviewKind;
  id: string;
  parent_id: string | null;
  label: string;
  source_url: string | null;
  cover_image_path: string | null;
  review_status: ReviewStatus;
  created_from: Provenance;
  created_by: string | null;
  created_at: string;
  open_reports: number;
}

export interface OpenReport {
  id: string;
  target_kind: ReviewKind;
  target_id: string;
  reason: ReportReason;
  note: string | null;
  created_at: string;
}

export interface QueueItem extends QueueRow {
  parentName: string | null;
  // Title the record belongs to: itself for a title, its title for an issue,
  // the parent issue's title for a variant.
  titleId: string | null;
  reports: OpenReport[];
  coverUrl: string | null;
  // The reader who added it has lost add rights (three rejected additions).
  addingPaused: boolean;
}

export interface CoverageTitle {
  id: string;
  name: string;
  catalogue_coverage: CatalogueCoverage;
}

export interface IndexReviewData {
  items: QueueItem[];
  coverageTitles: CoverageTitle[];
}

export interface MergeCandidate {
  id: string;
  label: string;
}

const READER_UPLOADS = "reader-uploads/";

// Reader uploads sit in a private bucket and need a signed URL; everything
// else is in the public covers bucket. Paths may carry the bucket prefix.
async function coverUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  // Seeded issues can point at a full URL (platform listings, checked CSVs).
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith(READER_UPLOADS)) {
    const { data, error } = await supabase.storage
      .from("reader-uploads")
      .createSignedUrl(path.slice(READER_UPLOADS.length), 60 * 60);
    return error ? null : data.signedUrl;
  }
  return supabase.storage.from("covers").getPublicUrl(path.replace(/^covers\//, ""))
    .data.publicUrl;
}

async function selectIn<T>(table: string, columns: string, ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from(table).select(columns).in("id", ids);
  if (error) throw error;
  return (data || []) as T[];
}

const unique = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => !!v))];

async function loadQueue(): Promise<IndexReviewData> {
  const rows = ((await call("get_directory_review_queue")) || []) as QueueRow[];
  const ofKind = (kind: ReviewKind) => rows.filter((r) => r.kind === kind);

  // Variants hang off an issue; fetch those issues first to reach their titles.
  const variantIssues = await selectIn<{ id: string; title_id: string; issue_label: string }>(
    "directory_issues",
    "id, title_id, issue_label",
    unique(ofKind("variant").map((r) => r.parent_id)),
  );
  const issueById = new Map(variantIssues.map((i) => [i.id, i]));

  const titleIds = unique([
    ...ofKind("issue").map((r) => r.parent_id),
    ...variantIssues.map((i) => i.title_id),
  ]);
  const creatorIds = unique(
    rows.filter((r) => r.created_from === "reader_created").map((r) => r.created_by),
  );
  const [titles, publishers, reportsResult, collectorsResult] = await Promise.all([
    selectIn<CoverageTitle>("directory_titles", "id, name, catalogue_coverage", titleIds),
    selectIn<{ id: string; name: string }>(
      "directory_publishers",
      "id, name",
      unique(ofKind("title").map((r) => r.parent_id)),
    ),
    rows.some((r) => Number(r.open_reports) > 0)
      ? db
          .from("content_reports")
          .select("id, target_kind, target_id, reason, note, created_at")
          .in("target_id", rows.filter((r) => Number(r.open_reports) > 0).map((r) => r.id))
          .is("resolved_at", null)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length > 0
      ? db.from("collectors").select("user_id, can_add").in("user_id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (reportsResult.error) throw reportsResult.error;
  if (collectorsResult.error) throw collectorsResult.error;
  const pausedCollectors = new Set(
    ((collectorsResult.data || []) as { user_id: string; can_add: boolean }[])
      .filter((c) => !c.can_add)
      .map((c) => c.user_id),
  );
  const reports = (reportsResult.data || []) as OpenReport[];

  const titleById = new Map(titles.map((t) => [t.id, t]));
  const publisherById = new Map(publishers.map((p) => [p.id, p]));

  const items = await Promise.all(
    rows.map(async (row): Promise<QueueItem> => {
      let parentName: string | null = null;
      let titleId: string | null = null;
      if (row.kind === "issue") {
        titleId = row.parent_id;
        parentName = (row.parent_id && titleById.get(row.parent_id)?.name) || null;
      } else if (row.kind === "title") {
        titleId = row.id;
        parentName = (row.parent_id && publisherById.get(row.parent_id)?.name) || null;
      } else if (row.kind === "variant") {
        const issue = row.parent_id ? issueById.get(row.parent_id) : undefined;
        titleId = issue?.title_id ?? null;
        parentName = issue
          ? [titleById.get(issue.title_id)?.name, issue.issue_label].filter(Boolean).join(", ")
          : null;
      }
      return {
        ...row,
        open_reports: Number(row.open_reports),
        parentName,
        titleId,
        reports: reports.filter((r) => r.target_id === row.id),
        coverUrl: await coverUrl(row.cover_image_path),
        addingPaused: !!row.created_by && pausedCollectors.has(row.created_by),
      };
    }),
  );

  // Coverage is only worth checking for titles whose issue list changed.
  const changedTitleIds = new Set(unique(ofKind("issue").map((r) => r.parent_id)));
  return { items, coverageTitles: titles.filter((t) => changedTitleIds.has(t.id)) };
}

export function useIndexReviewQueue() {
  return useQuery({
    queryKey: ["index-review"],
    queryFn: loadQueue,
  });
}

/** Search merge targets: titles by name, or issues on the same title by label. */
export async function searchMergeTargets(
  item: QueueItem,
  term: string,
): Promise<MergeCandidate[]> {
  const pattern = `%${term.trim().replace(/[%_]/g, "")}%`;
  if (item.kind === "title") {
    const { data, error } = await db
      .from("directory_titles")
      .select("id, name")
      .ilike("name", pattern)
      .neq("id", item.id)
      .order("name")
      .limit(10);
    if (error) throw error;
    return ((data || []) as { id: string; name: string }[]).map((t) => ({
      id: t.id,
      label: t.name,
    }));
  }
  if (item.kind === "issue" && item.titleId) {
    const { data, error } = await db
      .from("directory_issues")
      .select("id, issue_label")
      .eq("title_id", item.titleId)
      .is("merged_into", null)
      .neq("id", item.id)
      .neq("review_status", "rejected")
      .ilike("issue_label", pattern)
      .order("issue_number", { ascending: true, nullsFirst: false })
      .limit(20);
    if (error) throw error;
    return ((data || []) as { id: string; issue_label: string }[]).map((i) => ({
      id: i.id,
      label: i.issue_label,
    }));
  }
  return [];
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Copy an approved reader cover into the public covers bucket and point the
// issue at it. The reader-uploads object stays in place.
async function moveReaderCover(issueId: string, path: string) {
  const { data: blob, error: downloadError } = await supabase.storage
    .from("reader-uploads")
    .download(path.slice(READER_UPLOADS.length));
  if (downloadError) throw downloadError;
  const ext =
    EXT_BY_TYPE[blob.type] || path.split(".").pop()?.toLowerCase() || "jpg";
  const target = `issues/${issueId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("covers")
    .upload(target, blob, { upsert: true, contentType: blob.type || undefined });
  if (uploadError) throw uploadError;
  const { error: updateError } = await db
    .from("directory_issues")
    .update({ cover_image_path: target })
    .eq("id", issueId);
  if (updateError) throw updateError;
}

export function useReviewRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      kind: ReviewKind;
      id: string;
      status: ReviewStatus;
      note?: string;
      sourceUrl?: string;
      coverPath?: string | null;
    }) => {
      await call("review_directory_record", {
        p_kind: args.kind,
        p_id: args.id,
        p_status: args.status,
        p_note: args.note || null,
        p_source_url: args.sourceUrl || null,
      });
      if (
        args.kind === "issue" &&
        args.status === "approved" &&
        args.coverPath?.startsWith(READER_UPLOADS)
      ) {
        try {
          await moveReaderCover(args.id, args.coverPath);
        } catch (err) {
          const reason = err instanceof Error ? err.message : "unknown error";
          throw new Error(`Approved, but the cover could not be moved: ${reason}`);
        }
      }
    },
    // Settled, not success: a failed cover move still follows an approval.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["index-review"] });
    },
  });
}

export function useAllowAdding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await db
        .from("collectors")
        .update({ can_add: true })
        .eq("user_id", userId)
        .select("user_id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Not permitted to update this reader");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["index-review"] });
    },
  });
}

export function useMergeRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { kind: "issue" | "title"; fromId: string; intoId: string }) =>
      call(args.kind === "issue" ? "merge_issue" : "merge_title", {
        from_id: args.fromId,
        into_id: args.intoId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["index-review"] });
    },
  });
}

export function useIssueToVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      issueId: string;
      parentId: string;
      kind: VariantKind;
      label?: string;
    }) =>
      call("issue_to_variant", {
        p_issue_id: args.issueId,
        p_parent_id: args.parentId,
        p_kind: args.kind,
        p_label: args.label || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["index-review"] });
    },
  });
}

export function useSetCoverage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { titleId: string; coverage: CatalogueCoverage }) => {
      const { data, error } = await db
        .from("directory_titles")
        .update({
          catalogue_coverage: args.coverage,
          coverage_checked_at: new Date().toISOString(),
        })
        .eq("id", args.titleId)
        .select("id");
      if (error) throw error;
      // RLS hides a blocked update as zero rows rather than an error.
      if (!data || data.length === 0) throw new Error("Not permitted to update this title");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["index-review"] });
    },
  });
}
