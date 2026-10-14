# NNS reuse audit and integration boundary

2026-10-14. Code-backed assessment, not confirmation that every checked-in
migration is applied to the live main Supabase database.

| Asset | Finding | Treatment |
| --- | --- | --- |
| Legacy Lovable extract-emails | filterEmails removes hello/info/contact and other generic prefixes; required HasData call | Replace in standalone path; do not modify legacy function |
| Legacy export | 100 stable-ID NYC lead rows with websites; status_history and notes included | Preserve raw rows and separate proposals; no writeback |
| Marketplace React app | Admin layout, protected routes and UI exist | Reuse for later NNS interface |
| Marketplace authorization | Client guard and public.is_admin SQL helper exist | Verify live claims/grants/RLS; client route guard alone is insufficient |
| Marketplace data | retailers appears in types and migrations | Foreign-key link after live identity/schema verification |
| Public Index | directory_stores, directory_stockists, directory_titles, directory_publishers referenced in code | Link canonical IDs; no cloned catalog |
| Public stockists | Public policies/views exist | Never add private contacts/history to these relations |
| Hosting | Existing commit status confirms Vercel Git deployment | Disable this exact feature branch in its initial commit |

The worker reuses the existing repository and data shapes. It does not bring
over the paid API functions, Supabase keys or a second application.

## Future migration plan, not executable in this PR

1. Read the live shared-project schema, grants and RLS, including canonical
   store/retailer IDs and exact request-table names.
2. Export all legacy leads and related stage/log/list/template data with counts
   and hashes. The 100-row pilot is not a full backup.
3. Use a disposable database to build private tables and Gem-only authorization.
   Null/unknown roles must fail closed. Client route checks are insufficient.
4. Preserve IDs, source mappings, manual corrections and append-only evidence.
   Domain alone is not a safe physical-location merge key.
5. Produce a dry-run reconciliation. Exact stable identifiers may link; ambiguous
   name/address/domain matches go to human review.
6. Verify anonymous/retailer/publisher requests cannot read NNS and that public
   Index views cannot expose NNS contacts.
7. Reconcile counts, histories, suppressions, phones and overrides, then request
   approval for the concrete production migration.
8. Roll back through preserved legacy data/mappings and an integration feature
   flag. Do not retire/delete Lovable as part of the pilot.

The pilot needs no database credentials after the authorized read-only export.
Production integration remains outside this slice.

## Next milestones

1. Run the prepared live pilot on a permitted machine and complete source audit.
2. Validate fit rules and obtain the original buyer 2x2 axes/mapping.
3. Add dry-run CSV/open-data discovery and reconciliation with the Index.
4. Add Gem-only UI/backend after authorization tests, migration review and
   deployment approval.
