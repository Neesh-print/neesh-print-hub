import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { StartSellingCard } from "@/components/publisher/StartSellingCard";
import { useAuth } from "@/hooks/useAuth";
import { ButtonPrimary, FormInput, FormSelect, FormTextarea } from "@/components/neesh";
import {
  useIndexListing,
  useSaveIndexPublisher,
  useSaveIndexTitle,
  type IndexPublisher,
  type IndexTag,
  type IndexTitle,
} from "@/hooks/useIndexListing";
import {
  FREQUENCIES,
  MAX_COVER_BYTES,
  MAX_OTHER_NICHES,
  STATUSES,
} from "../../../supabase/functions/_shared/index-listing";

// Edit the publisher's page on the Neesh Index. Only the publisher who
// claimed the listing reaches this: the edge function returns nothing for
// anyone else, and the nav item is hidden for them.

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  bimonthly: "Every two months",
  quarterly: "Quarterly",
  triannual: "Three times a year",
  biannual: "Twice a year",
  annual: "Annual",
  irregular: "Irregular",
  evergreen: "Evergreen, no fixed schedule",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Currently publishing",
  dormant: "On hiatus",
  ceased: "Stopped publishing (takes the page down)",
};

const COUNTRIES = (() => {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const out: { value: string; label: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (/^(Q[M-Z]|X[A-Z]|ZZ|AA|EU|EZ|UN)$/.test(code)) continue;
      try {
        const name = names.of(code);
        if (name && name !== code) out.push({ value: code, label: name });
      } catch {
        // not a region
      }
    }
  }
  return [{ value: "", label: "Not set" }, ...out.sort((x, y) => x.label.localeCompare(y.label))];
})();

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function PublisherCard({ publisher, site }: { publisher: IndexPublisher; site: string }) {
  const save = useSaveIndexPublisher();
  const [form, setForm] = useState({
    name: publisher.name,
    website: str(publisher.website),
    city: str(publisher.city),
    country: str(publisher.country),
    stockist_page_url: str(publisher.stockist_page_url),
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await save.mutateAsync({ publisher_id: publisher.id, fields: form });
      toast.success(res.changed ? "Saved. Your Index page is updated." : "Nothing to change.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="card-neesh space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-display font-semibold text-lg text-foreground">Publisher details</h3>
        <a
          href={`${site}/publishers/${publisher.slug}`}
          target="_blank"
          rel="noopener"
          className="text-caption text-accent inline-flex items-center gap-1 hover:underline"
        >
          View on the Index <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <FormInput label="Publisher name" required maxLength={200} value={form.name} onChange={set("name")} />
      <FormInput label="Website" type="url" maxLength={500} placeholder="https://" value={form.website} onChange={set("website")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput label="City" maxLength={100} value={form.city} onChange={set("city")} />
        <FormSelect label="Country" options={COUNTRIES} value={form.country} onChange={set("country")} />
      </div>
      <FormInput
        label="Stockist list"
        type="url"
        maxLength={500}
        placeholder="https://"
        value={form.stockist_page_url}
        onChange={set("stockist_page_url")}
        helperText="The page on your site that lists the shops carrying you. The Index reads it to show readers where to buy."
      />
      <ButtonPrimary type="submit" loading={save.isPending}>Save publisher details</ButtonPrimary>
    </form>
  );
}

function TitleCard({ title, tags, site }: { title: IndexTitle; tags: IndexTag[]; site: string }) {
  const save = useSaveIndexTitle();
  const subjects = useMemo(() => tags.filter((t) => t.category === "subject"), [tags]);
  const identities = useMemo(() => tags.filter((t) => t.category !== "subject"), [tags]);

  const initial = useMemo(() => {
    const links = title.directory_title_tags ?? [];
    const subjectLinks = links.filter((l) => subjects.some((s) => s.id === l.tag_id));
    const primary = (subjectLinks.find((l) => l.is_primary) ?? subjectLinks[0])?.tag_id ?? "";
    return {
      fields: {
        name: title.name,
        description: str(title.description),
        frequency: str(title.frequency),
        cover_price: str(title.cover_price),
        currency: str(title.currency),
        trim_size: str(title.trim_size),
        page_count: str(title.page_count),
        country: str(title.country),
        city: str(title.city),
        status: title.status,
        last_issue_date: str(title.last_issue_date),
        subscribe_url: str(title.subscribe_url),
      },
      primary,
      others: subjectLinks.map((l) => l.tag_id).filter((id) => id !== primary),
      identity: links.filter((l) => identities.some((t) => t.id === l.tag_id)).map((l) => l.tag_id),
    };
  }, [title, subjects, identities]);

  const [fields, setFields] = useState(initial.fields);
  const [primary, setPrimary] = useState(initial.primary);
  const [others, setOthers] = useState<string[]>(initial.others);
  const [identity, setIdentity] = useState<string[]>(initial.identity);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!cover) return setCoverPreview(null);
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const set = (k: keyof typeof fields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));

  function toggleOther(id: string) {
    setOthers((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_OTHER_NICHES) {
        toast.message(`Pick up to ${MAX_OTHER_NICHES} other niches besides the main one.`);
        return cur;
      }
      return [...cur, id];
    });
  }

  function choosePrimary(id: string) {
    setPrimary(id);
    setOthers((cur) => cur.filter((x) => x !== id));
  }

  function pickCover(file: File | undefined) {
    if (!file) return setCover(null);
    if (file.size > MAX_COVER_BYTES) {
      toast.error("Covers can be up to 4 MB.");
      return;
    }
    setCover(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!primary) {
      toast.error("Choose the main niche the title belongs in.");
      return;
    }
    try {
      const res = await save.mutateAsync({
        title_id: title.id,
        fields,
        niches: { primary, others, identity },
        cover: cover ? { data: await readAsBase64(cover) } : undefined,
      });
      setCover(null);
      toast.success(res.changed ? "Saved. Your Index page is updated." : "Nothing to change.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const pill = (on: boolean) =>
    `px-3 py-1.5 rounded-full border text-body transition-colors ${
      on ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:border-foreground"
    }`;

  return (
    <form onSubmit={submit} className="card-neesh space-y-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-display font-semibold text-lg text-foreground">{title.name}</h3>
        {title.status !== "ceased" && (
          <a
            href={`${site}/titles/${title.slug}`}
            target="_blank"
            rel="noopener"
            className="text-caption text-accent inline-flex items-center gap-1 hover:underline"
          >
            View on the Index <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <FormInput label="Title name" required maxLength={200} value={fields.name} onChange={set("name")} />
      <FormTextarea
        label="Description"
        rows={6}
        maxLength={3000}
        value={fields.description}
        onChange={set("description")}
        helperText="What the magazine covers and who it is for, in your own words."
      />

      <div>
        <span className="block mb-1.5 font-display font-medium text-body text-foreground">Cover</span>
        <div className="flex items-center gap-4 flex-wrap">
          {coverPreview || title.cover_url ? (
            <img
              src={coverPreview ?? title.cover_url ?? undefined}
              alt={`Cover of ${title.name}`}
              className="w-24 aspect-[3/4] object-cover rounded border border-border"
            />
          ) : (
            <div className="w-24 aspect-[3/4] rounded border border-border grid place-items-center text-caption text-muted-foreground text-center">
              No cover yet
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pickCover(e.target.files?.[0])}
            aria-label="Upload a new cover"
            className="text-body"
          />
        </div>
        <p className="mt-1.5 text-caption text-muted-foreground">JPEG, PNG or WebP, up to 4 MB. Leave it to keep the current cover.</p>
      </div>

      <div className="space-y-3">
        <FormSelect
          label="Main niche"
          required
          placeholder="Choose one"
          options={subjects.map((t) => ({ value: t.id, label: t.name }))}
          value={primary}
          onChange={choosePrimary}
        />
        <p className="-mt-1.5 text-caption text-muted-foreground">
          Where the title sits on the Index: its niche page, breadcrumb and share card.
        </p>
        <div>
          <span className="block mb-1.5 font-display font-medium text-body text-foreground">
            Also fits (up to {MAX_OTHER_NICHES})
          </span>
          <div className="flex flex-wrap gap-2">
            {subjects
              .filter((t) => t.id !== primary)
              .map((t) => (
                <button key={t.id} type="button" className={pill(others.includes(t.id))} aria-pressed={others.includes(t.id)} onClick={() => toggleOther(t.id)}>
                  {t.name}
                </button>
              ))}
          </div>
        </div>
        {identities.length > 0 && (
          <div>
            <span className="block mb-1.5 font-display font-medium text-body text-foreground">Who makes it (optional)</span>
            <div className="flex flex-wrap gap-2">
              {identities.map((t) => {
                const on = identity.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={pill(on)}
                    aria-pressed={on}
                    onClick={() => setIdentity((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          label="Status"
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          value={fields.status}
          onChange={(v) => setFields((f) => ({ ...f, status: v as typeof f.status }))}
        />
        <FormSelect
          label="Frequency"
          options={[{ value: "", label: "Not set" }, ...FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))]}
          value={fields.frequency}
          onChange={set("frequency")}
        />
        <FormInput label="Latest issue date" type="date" value={fields.last_issue_date} onChange={set("last_issue_date")} />
        <FormInput label="Pages" type="number" min={1} max={5000} step={1} value={fields.page_count} onChange={set("page_count")} />
        <FormInput label="Cover price" type="number" min={0} max={10000} step="0.01" value={fields.cover_price} onChange={set("cover_price")} />
        <FormInput label="Currency" maxLength={3} placeholder="USD" value={fields.currency} onChange={(v) => set("currency")(v.toUpperCase())} />
        <FormInput label="Trim size" maxLength={60} placeholder="230 x 300 mm" value={fields.trim_size} onChange={set("trim_size")} />
        <FormInput label="City" maxLength={100} value={fields.city} onChange={set("city")} />
        <FormSelect label="Country" options={COUNTRIES} value={fields.country} onChange={set("country")} />
      </div>
      <FormInput
        label="Subscription page"
        type="url"
        maxLength={500}
        placeholder="https://"
        value={fields.subscribe_url}
        onChange={set("subscribe_url")}
        helperText="Shown on your Index page as a subscribe link."
      />

      <ButtonPrimary type="submit" loading={save.isPending}>Save {title.name}</ButtonPrimary>
    </form>
  );
}

export const PublisherIndexListing = () => {
  const { data, isLoading, error } = useIndexListing();
  const { publisherStatus } = useAuth();
  const claimOnly = !!publisherStatus && !publisherStatus.sellsOnNeesh;
  const site = data?.index_site ?? "https://neesh.art";

  return (
    <PublisherLayout>
      <div className="px-4 md:px-6 pb-12 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Index listing</h1>
          <p className="text-muted-foreground mt-2">
            Your page on the Neesh Index, where shops, cafés and readers find titles. Edit anything
            here and it is live on the Index as soon as you save. Renaming a title keeps its address.
          </p>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-secondary rounded" />
            <div className="h-72 bg-secondary rounded" />
          </div>
        ) : error ? (
          <div className="card-neesh text-muted-foreground">Your listing did not load. Refresh to try again.</div>
        ) : !data || data.publishers.length === 0 ? (
          <div className="card-neesh text-muted-foreground">
            There is no claimed Index listing on this account. If one of your titles is on the Index
            and should be yours, email <a href="mailto:hi@neesh.art" className="text-accent underline">hi@neesh.art</a>.
          </div>
        ) : (
          data.publishers.map((publisher) => (
            <div key={publisher.id} className="space-y-6">
              <PublisherCard publisher={publisher} site={site} />
              {data.titles
                .filter((t) => t.publisher_id === publisher.id)
                .map((title) => (
                  <TitleCard key={`${title.id}-${title.cover_image_path ?? ""}`} title={title} tags={data.tags} site={site} />
                ))}
            </div>
          ))
        )}

        {claimOnly && !isLoading && <StartSellingCard />}

        <p className="text-caption text-muted-foreground">
          Want a title taken off the Index, or a niche that is not on the list? Email{" "}
          <a href="mailto:hi@neesh.art" className="text-accent underline">hi@neesh.art</a>.
        </p>
      </div>
    </PublisherLayout>
  );
};

export default PublisherIndexListing;
