import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { PGlite } = await import(
  process.env.NUSTAND_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
await db.exec(`create role anon;create role authenticated;create role service_role;
create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.users(id uuid primary key,role text);insert into public.users values('${owner}','admin'),('${other}','admin');
create table public.directory_stores(id uuid,name text,city text);
create table public.directory_publishers(id uuid,eligible boolean,removed boolean);
create table public.directory_stockists(store_id uuid,publisher_id uuid,is_current boolean,source_url text);
insert into public.directory_stores values('${owner}','Example Space','New York');
insert into public.directory_publishers values('${other}',true,false);
insert into public.directory_stockists values('${owner}','${other}',true,'https://publisher.neesh-fixture.org/stockists');
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.users where id=auth.uid() and role='admin')$$;
alter default privileges in schema public grant execute on functions to anon,authenticated;`);
await db.exec(
  readFileSync(new URL("./nustand_review_draft.sql", import.meta.url), "utf8"),
);
await db.query("insert into nustand_private.owner(user_id) values($1)", [
  owner,
]);
const as = async (id, role = "authenticated") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
};
const source = {
  id: "space",
  name: "Example Space",
  city: "New York",
  website: "https://example.org",
  do_not_contact: false,
  original_record: { notes: "Keep me", phone: "Raw phone" },
  contacts: [],
  job: { status: "not_started" },
  fit: { score: null },
};
await as(owner);
await db.query("select public.nustand_import($1::jsonb)", [
  JSON.stringify([source]),
]);
await db.exec("reset role");
await db.exec(
  readFileSync(new URL("./research_jobs_draft.sql", import.meta.url), "utf8"),
);
await as(owner);
await assert.rejects(() =>
  db.query("select public.nustand_research_queue(array['space'])"),
);
await db.exec(
  "reset role;update nustand_private.research_settings set enabled=true",
);
await as(other);
await assert.rejects(() => db.query("select public.nustand_research_status()"));
await as("", "anon");
await assert.rejects(() => db.query("select public.nustand_research_status()"));
await as(owner);
assert.equal(
  (await db.query("select public.nustand_research_queue(array['space']) n"))
    .rows[0].n,
  1,
);
assert.equal(
  (await db.query("select public.nustand_research_queue(array['space']) n"))
    .rows[0].n,
  0,
);
await assert.rejects(() => db.query("select public.nustand_worker_claim()"));
await assert.rejects(() =>
  db.query("select * from nustand_private.research_jobs"),
);
await as("", "service_role");
const jobs = (await db.query("select public.nustand_worker_claim() jobs"))
  .rows[0].jobs;
assert.equal(jobs.length, 1);
assert.equal(jobs[0].source.original_record.notes, undefined);
assert.equal(jobs[0].source.original_record.phone, "Raw phone");
assert.equal(
  jobs[0].source.website_lookup_sources[0].source_url,
  "https://publisher.neesh-fixture.org/stockists",
);
const payload = {
  status: "completed",
  contacts: [
    {
      id: "new-email",
      kind: "email",
      value: "hello@example.org",
      quality_status: "observed_on_website",
      review_reasons: [],
      evidence: [
        {
          source_url: "https://example.org/contact",
          observed_at: "2026-10-14",
          extract_method: "mailto",
        },
      ],
    },
  ],
  fit: { score: 20, segment: "Catalog", uncertainties: [] },
  job: { status: "completed", finished_at: "2026-10-14T00:00:00Z" },
  website: "https://example.org",
  contact_score: 60,
  requests: 2,
  pages: 1,
};
await assert.rejects(() =>
  db.query("select public.nustand_worker_finish($1,null,$2::jsonb)", [
    jobs[0].id,
    JSON.stringify(payload),
  ]),
);
await assert.rejects(() =>
  db.query("select public.nustand_worker_finish($1,$2,$3::jsonb)", [
    jobs[0].id,
    other,
    JSON.stringify(payload),
  ]),
);
await db.query("select public.nustand_worker_finish($1,$2,$3::jsonb)", [
  jobs[0].id,
  jobs[0].lease,
  JSON.stringify(payload),
]);
await assert.rejects(() =>
  db.query("select public.nustand_worker_finish($1,$2,$3::jsonb)", [
    jobs[0].id,
    jobs[0].lease,
    JSON.stringify(payload),
  ]),
);
await as(owner);
let row = (await db.query("select public.nustand_list() rows")).rows[0].rows[0];
assert.deepEqual(row.source.original_record, source.original_record);
assert.equal(row.source.contacts[0].value, "hello@example.org");
assert.equal(row.source.fit.score, 20);
assert.deepEqual(row.review.contacts, {});
assert.equal(
  (await db.query("select public.nustand_export(array['space']) rows")).rows[0]
    .rows.length,
  0,
);
const review = {
  ...row.review,
  stage: "Qualified",
  contacts: { "new-email": "accepted" },
};
await db.query("select public.nustand_review($1,$2,$3::jsonb)", [
  "space",
  row.version,
  JSON.stringify(review),
]);
assert.equal(
  (
    await db.query(
      "select public.nustand_contact_value('space','new-email') value",
    )
  ).rows[0].value,
  "hello@example.org",
);
assert.equal(
  (await db.query("select public.nustand_export(array['space']) rows")).rows[0]
    .rows.length,
  1,
);
assert.equal(
  (await db.query("select public.nustand_research_queue(array['space']) n"))
    .rows[0].n,
  0,
); // freshness cooldown
await db.query(
  "select public.nustand_set_website('space','https://example.org/new')",
);
assert.equal(
  (await db.query("select public.nustand_research_queue(array['space']) n"))
    .rows[0].n,
  1,
);
await as("", "service_role");
const next = (await db.query("select public.nustand_worker_claim() jobs"))
  .rows[0].jobs[0];
await as(owner);
row = (await db.query("select public.nustand_list() rows")).rows[0].rows[0];
await db.query("select public.nustand_review($1,$2,$3::jsonb)", [
  "space",
  row.version,
  JSON.stringify({ ...review, do_not_contact: true }),
]);
await as("", "service_role");
await db.query("select public.nustand_worker_finish($1,$2,$3::jsonb)", [
  next.id,
  next.lease,
  JSON.stringify(payload),
]);
await as(owner);
assert.equal(
  (await db.query("select public.nustand_export(array['space']) rows")).rows[0]
    .rows.length,
  0,
);
await as("", "service_role");
for (let i = 0; i < 50; i++)
  assert.equal(
    (await db.query("select public.nustand_worker_place_budget() allowed"))
      .rows[0].allowed,
    true,
  );
assert.equal(
  (await db.query("select public.nustand_worker_place_budget() allowed"))
    .rows[0].allowed,
  false,
);
if (process.env.NUSTAND_PRIVATE_CSV) {
  const input = JSON.parse(
    readFileSync(process.env.NUSTAND_PRIVATE_CSV, "utf8"),
  );
  await db.exec(
    "reset role; truncate nustand_private.research_jobs,nustand_private.review_events,nustand_private.prospects",
  );
  await as(owner);
  await db.query("select public.nustand_import($1::jsonb)", [
    JSON.stringify(input.records),
  ]);
  assert.equal(
    (
      await db.query("select public.nustand_research_queue($1::text[]) n", [
        input.records.map((r) => r.id),
      ])
    ).rows[0].n,
    260,
  );
  await as("", "service_role");
  const batch = (await db.query("select public.nustand_worker_claim() jobs"))
    .rows[0].jobs;
  assert.equal(batch.length, 10);
  for (const job of batch)
    await db.query("select public.nustand_worker_finish($1,$2,$3::jsonb)", [
      job.id,
      job.lease,
      JSON.stringify(payload),
    ]);
  await db.exec("reset role");
  const originals = (
    await db.query("select source from nustand_private.prospects")
  ).rows;
  for (const expected of input.records)
    assert.deepEqual(
      originals.find((r) => r.source.id === expected.id).source,
      expected,
    );
  await as(owner);
  assert.equal(
    (await db.query("select public.nustand_list() rows")).rows[0].rows.length,
    260,
  );
  assert.equal(
    (
      await db.query("select public.nustand_export($1::text[]) rows", [
        input.records.map((r) => r.id),
      ])
    ).rows[0].rows.length,
    0,
  );
  console.log(
    "PASS: actual 260-space queue, ten leased completions, unchanged original CSV records and no automatic contact approval.",
  );
}
console.log(
  "PASS: queue permissions, disabled worker, leases, immutable originals, enriched-contact decisions/export, cooldown, suppression and daily place budget.",
);
