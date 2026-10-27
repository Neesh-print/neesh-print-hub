alter policy directory_titles_public_read on directory_titles
  using (
    removed = false
    and merged_into is null
    and review_status <> 'rejected'
    and status in ('active','dormant')
    and exists (
      select 1 from directory_publishers p
      where p.id = directory_titles.publisher_id
        and p.removed = false
        and p.eligible = true
    )
  );
alter policy directory_publishers_public_read on directory_publishers
  using (
    removed = false and eligible = true and merged_into is null and review_status <> 'rejected'
  );

create policy directory_issues_public_read on directory_issues
  for select using (
    not removed and merged_into is null and review_status <> 'rejected'
    and exists (select 1 from directory_titles t where t.id = directory_issues.title_id)
  );
create policy directory_issue_variants_public_read on directory_issue_variants
  for select using (
    review_status <> 'rejected'
    and exists (select 1 from directory_issues i where i.id = directory_issue_variants.issue_id)
  );

create policy directory_issues_reader_edit on directory_issues
  for update to authenticated
  using (created_by = auth.uid() and created_from = 'reader_created' and review_status = 'pending')
  with check (created_by = auth.uid() and created_from = 'reader_created' and review_status = 'pending');
create policy directory_titles_reader_edit on directory_titles
  for update to authenticated
  using (created_by = auth.uid() and created_from = 'reader_created' and review_status = 'pending')
  with check (created_by = auth.uid() and created_from = 'reader_created' and review_status = 'pending');

create policy directory_issue_availability_public_read on directory_issue_availability
  for select using (expires_on >= current_date);

create policy collectors_owner on collectors
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collection_items_owner on collection_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collector_titles_owner on collector_titles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy availability_requests_owner on availability_requests
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy content_reports_insert on content_reports
  for insert to authenticated with check (reporter_id = auth.uid());
create policy content_reports_admin_read on content_reports
  for select to authenticated using (coalesce(is_admin(), false));

create function collectors_guard_can_add() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' and not coalesce(is_admin(), false) then
    if tg_op = 'INSERT' then
      new.can_add := true;
    else
      new.can_add := old.can_add;
    end if;
  end if;
  return new;
end $$;
create trigger collectors_guard_can_add
  before insert or update on collectors
  for each row execute function collectors_guard_can_add();

create policy directory_issues_admin on directory_issues
  for all to authenticated using (coalesce(is_admin(), false)) with check (coalesce(is_admin(), false));
create policy directory_issue_variants_admin on directory_issue_variants
  for all to authenticated using (coalesce(is_admin(), false)) with check (coalesce(is_admin(), false));
create policy directory_issue_availability_admin on directory_issue_availability
  for all to authenticated using (coalesce(is_admin(), false)) with check (coalesce(is_admin(), false));
create policy content_reports_admin_update on content_reports
  for update to authenticated using (coalesce(is_admin(), false)) with check (coalesce(is_admin(), false));
create policy directory_titles_admin on directory_titles
  for all to authenticated using (coalesce(is_admin(), false)) with check (coalesce(is_admin(), false));
create policy directory_publishers_admin on directory_publishers
  for all to authenticated using (coalesce(is_admin(), false)) with check (coalesce(is_admin(), false));
create policy collectors_admin on collectors
  for all to authenticated using (coalesce(is_admin(), false)) with check (coalesce(is_admin(), false));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reader-uploads', 'reader-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy reader_uploads_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'reader-uploads' and coalesce(public.is_admin(), false));
create policy covers_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'covers' and coalesce(public.is_admin(), false));
create policy covers_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'covers' and coalesce(public.is_admin(), false));
create policy covers_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'covers' and coalesce(public.is_admin(), false));;
