revoke select on directory_publishers from anon, authenticated;
grant select (
  id, name, slug, website, country, city,
  eligible, claimed, claimed_at, removed, created_from,
  created_at, updated_at,
  stockist_page_url, stockist_status, stockist_note, stockist_checked_at
) on directory_publishers to anon, authenticated;;
