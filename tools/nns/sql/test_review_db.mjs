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
create schema auth; create table auth.users(id uuid primary key);
insert into auth.users values ('${owner}'), ('${other}');
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function public.is_admin() returns boolean language sql as $$ select current_setting('test.admin',true) = 'yes' $$;
`);
await db.exec(
  readFileSync(new URL("./nustand_review_draft.sql", import.meta.url), "utf8"),
);
const reject = async (sql, args = []) =>
  assert.rejects(() => db.query(sql, args));
const list = () => db.query("select public.nustand_list() result");
const setUser = async (id, admin) => {
  await db.query(
    "select set_config('test.uid',$1,false), set_config('test.admin',$2,false)",
    [id, admin],
  );
};
await setUser(owner, "yes");
await reject("select public.nustand_list()"); // no configured owner: deny
await db.query("insert into nustand_private.owner(user_id) values ($1)", [
  owner,
]);
await db.exec("set role anon");
await reject("select public.nustand_list()");
await db.exec("reset role; set role authenticated");
await setUser("", "yes");
await reject("select public.nustand_list()");
await setUser(other, "yes");
await reject("select public.nustand_list()");
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
console.log(
  "PASS: owner-only RPCs, role denials, private tables, atomic import, suppression, immutable source, optimistic locking and review history.",
);
await db.close();
