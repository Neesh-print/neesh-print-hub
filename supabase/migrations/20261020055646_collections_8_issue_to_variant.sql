-- Needs merge_issue (collections_4_merges) at call time.
create function issue_to_variant(p_issue_id uuid, p_parent_id uuid, p_kind variant_kind, p_label text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' and not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;
  insert into directory_issue_variants (issue_id, kind, label, cover_image_path, barcode, source_url, created_from, created_by, review_status)
  select p_parent_id, p_kind, coalesce(p_label, issue_label), cover_image_path, barcode, source_url, created_from, created_by, 'approved'
  from directory_issues where id = p_issue_id
  returning id into v_id;
  perform merge_issue(p_issue_id, p_parent_id);
  return v_id;
end $$;
revoke all on function issue_to_variant(uuid, uuid, variant_kind, text) from public, anon;
grant execute on function issue_to_variant(uuid, uuid, variant_kind, text) to authenticated;;
