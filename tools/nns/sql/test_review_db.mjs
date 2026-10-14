// Run with NUSTAND_PGLITE_MODULE pointing to an external @electric-sql/pglite
// installation. It is a validation-only dependency, not a production service.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { PGlite } = await import(
  process.env.NUSTAND_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
await db.exec(`
create role anon; create role authenticated;
-- Mirror live public-function defaults to catch accidental anonymous exposure.
alter default privileges in schema public grant execute on functions to anon, authenticated;
create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
insert into auth.users values ('${owner}', 'owner@example.org', now()), ('${other}', 'other@example.org', now());
create function auth.uid() returns uuid language sql stable as $$
select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
 (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create table public.users(id uuid primary key, role varchar(50));
insert into public.users values ('${owner}','admin'),('${other}','admin');
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.users where id=auth.uid() and role='admin') $$;
`);
await db.exec(
  readFileSync(new URL("./nustand_review_draft.sql", import.meta.url), "utf8"),
);
const reject = async (sql, args = []) =>
  assert.rejects(() => db.query(sql, args));
const list = () => db.query("select public.nustand_list() result");
const setUser = async (id, admin) => {
  // This harness owns the disposable DB. Role changes below are fixture setup,
  // never operations against the live project.
  await db.exec("reset role");
  await db.query("update public.users set role=$1 where id=$2::uuid", [
    admin === "yes" ? "admin" : "retailer",
    id || null,
  ]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
await setUser(owner, "yes");
await reject("select public.nustand_list()"); // no configured owner: deny
await db.exec("reset role");
const enrollment = readFileSync(new URL("./enroll_owner_draft.sql", import.meta.url), "utf8");
await assert.rejects(() => db.exec(enrollment)); // unset identity
await db.query("select set_config('nustand.owner_id',$1,false), set_config('nustand.owner_email',$2,false)", [owner, "wrong@example.org"]);
await assert.rejects(() => db.exec(enrollment)); // mismatched identity
await db.query("select set_config('nustand.owner_email',$1,false)", ["owner@example.org"]);
await db.query("update public.users set role='retailer' where id=$1", [owner]);
await assert.rejects(() => db.exec(enrollment)); // never promote a non-admin
await db.query("update public.users set role='admin' where id=$1", [owner]);
await db.query("update auth.users set email_confirmed_at=null where id=$1", [owner]);
await assert.rejects(() => db.exec(enrollment)); // unconfirmed account
await db.query("update auth.users set email_confirmed_at=now() where id=$1", [owner]);
await db.exec(enrollment);
await db.exec(enrollment); // same owner is an idempotent retry
await db.query("select set_config('nustand.owner_id',$1,false), set_config('nustand.owner_email',$2,false)", [other, "other@example.org"]);
await assert.rejects(() => db.exec(enrollment)); // no silent owner replacement
assert.equal((await db.query("select user_id from nustand_private.owner")).rows[0].user_id, owner);
await db.exec("set role anon");
await reject("select public.nustand_list()");
await db.exec("reset role; set role authenticated");
await setUser("", "yes");
await reject("select public.nustand_list()");
await setUser(other, "yes");
await reject("select public.nustand_list()");
await reject("select nustand_private.nustand_list()");
await setUser(owner, "no");
await reject("select public.nustand_list()");
await setUser(owner, "yes");
assert.deepEqual((await list()).rows[0].result, []);
await reject("select * from nustand_private.prospects");
await reject("insert into nustand_private.owner(user_id) values ($1)", [other]);
const source = {
  id: "fixture",
  name: "Example Space",
  do_not_contact: true,
  original_record: { notes: "Keep original", phone: "(212) 555-0100" },
  contacts: [
    {
      id: "email",
      kind: "email",
      value: "hello@example.org",
      quality_status: "observed_on_website",
      review_reasons: [],
      evidence: [],
    },
  ],
  job: { status: "completed" },
  fit: { score: null },
};
const imported = await db.query(
  "select public.nustand_import($1::jsonb) result",
  [JSON.stringify([source])],
);
assert.equal(imported.rows[0].result, 1);
const review = {
  stage: "Qualified",
  notes: "Confirmed for this branch",
  segment: "Presence",
  fit_score: 70,
  next_follow_up: "2026-10-20",
  do_not_contact: false,
  contacts: { email: "accepted" },
};
assert.equal(
  (
    await db.query("select public.nustand_review($1,$2,$3::jsonb) result", [
      "fixture",
      0,
      JSON.stringify(review),
    ])
  ).rows[0].result,
  1,
);
await reject("select public.nustand_review($1,$2,$3::jsonb)", [
  "fixture",
  0,
  JSON.stringify(review),
]);
await reject("select public.nustand_review($1,$2,$3::jsonb)", [
  "fixture",
  1,
  JSON.stringify({ ...review, contacts: { missing: "accepted" } }),
]);
await reject("select public.nustand_review($1,$2,$3::jsonb)", [
  "fixture",
  1,
  JSON.stringify({ ...review, fit_score: 101 }),
]);
assert.equal(
  (
    await db.query("select public.nustand_import($1::jsonb) result", [
      JSON.stringify([
        { ...source, original_record: { notes: "Attempted overwrite" } },
      ]),
    ])
  ).rows[0].result,
  0,
);
const saved = (await list()).rows[0].result[0];
assert.deepEqual(saved.source, source);
assert.equal(saved.review.notes, review.notes);
assert.equal(saved.review.do_not_contact, true);
await db.exec("reset role");
assert.equal(
  (
    await db.query(
      "select count(*)::int total from nustand_private.review_events",
    )
  ).rows[0].total,
  1,
);
await db.exec("set role authenticated");
await reject("select public.nustand_import($1::jsonb)", [
  JSON.stringify([{ ...source, id: "new" }, { id: "bad" }]),
]);
assert.equal((await list()).rows[0].result.length, 1); // whole import rolled back
await reject("select public.nustand_import($1::jsonb)", [
  JSON.stringify([source, source]),
]);
const hundred = Array.from({ length: 100 }, (_, i) => ({
  ...source,
  id: `batch-${i}`,
}));
await reject("select public.nustand_import($1::jsonb)", [
  JSON.stringify(hundred),
]);
assert.equal((await list()).rows[0].result.length, 1); // capacity error atomic

// Exercise decisions changing in another tab after the first snapshot.
const currentSource = { ...source, id: "current", do_not_contact: false };
await db.query("select public.nustand_import($1::jsonb)", [
  JSON.stringify([currentSource]),
]);
await db.query("select public.nustand_review($1,$2,$3::jsonb)", [
  "current",
  0,
  JSON.stringify(review),
]);
assert.equal(
  (await db.query("select public.nustand_export(array['current']) result"))
    .rows[0].result.length,
  1,
);
assert.equal(
  (
    await db.query(
      "select public.nustand_contact_value('current','email') result",
    )
  ).rows[0].result,
  "hello@example.org",
);
await db.query("select public.nustand_review($1,$2,$3::jsonb)", [
  "current",
  1,
  JSON.stringify({ ...review, do_not_contact: true }),
]);
assert.deepEqual(
  (await db.query("select public.nustand_export(array['current']) result"))
    .rows[0].result,
  [],
);
await reject("select public.nustand_contact_value('current','email')");
await db.query("select public.nustand_review($1,$2,$3::jsonb)", [
  "current",
  2,
  JSON.stringify({ ...review, contacts: { email: "rejected" } }),
]);
assert.deepEqual(
  (await db.query("select public.nustand_export(array['current']) result"))
    .rows[0].result,
  [],
);
await reject("select public.nustand_contact_value('current','email')");
await setUser(other, "yes");
await reject("select public.nustand_export(array['current'])");
await reject("select public.nustand_contact_value('current','email')");
await setUser(owner, "yes");
await db.exec("reset role; set role anon");
await reject("select public.nustand_export(array['current'])");
await reject("select public.nustand_contact_value('current','email')");
await db.exec("reset role; set role authenticated");
// Optional integration with the private pilot. Never commit this data or log it.
if (process.env.NUSTAND_PRIVATE_PILOT) {
  const pilot = JSON.parse(
    readFileSync(process.env.NUSTAND_PRIVATE_PILOT, "utf8"),
  );
  assert.equal(pilot.schema_version, "0.2.2");
  assert.equal(pilot.records.length, 100);
  await db.exec(
    "reset role; truncate nustand_private.review_events, nustand_private.prospects; set role authenticated",
  );
  const count = await db.query(
    "select public.nustand_import($1::jsonb) result",
    [JSON.stringify(pilot.records)],
  );
  assert.equal(count.rows[0].result, 100);
  const rows = (await list()).rows[0].result;
  assert.equal(rows.length, 100);
  for (const original of pilot.records)
    assert.deepEqual(
      rows.find((r) => r.source.id === original.id).source,
      original,
    );
  assert.deepEqual(
    (
      await db.query("select public.nustand_export($1::text[]) result", [
        pilot.records.map((r) => r.id),
      ])
    ).rows[0].result,
    [],
  );
  console.log(
    "PASS: private 100-record import/list round trip preserves every original field; no contacts exported before review.",
  );
}
console.log(
  "PASS: owner-only RPCs, role denials, private tables, atomic import, suppression, immutable source, optimistic locking and review history.",
);
await db.close();
