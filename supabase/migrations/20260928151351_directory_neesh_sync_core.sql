
-- Links each Neesh listing (issue) to the Index title it belongs to.
create table if not exists public.directory_neesh_links (
  magazine_id uuid primary key references public.magazines(id) on delete cascade,
  title_id uuid not null references public.directory_titles(id) on delete cascade,
  link_method text,
  linked_at timestamptz not null default now()
);
create index if not exists directory_neesh_links_title_idx on public.directory_neesh_links(title_id);
alter table public.directory_neesh_links enable row level security;

-- Things the sync could not decide on its own, or new entries that need a human pass.
create table if not exists public.directory_sync_queue (
  id uuid primary key default gen_random_uuid(),
  magazine_id uuid references public.magazines(id) on delete cascade,
  neesh_publisher_id uuid references public.publishers(id) on delete cascade,
  title_id uuid references public.directory_titles(id) on delete set null,
  kind text not null check (kind in ('needs_decision','needs_copy','needs_tags','error')),
  reason text,
  candidates jsonb,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  resolved_at timestamptz
);
create unique index if not exists directory_sync_queue_open_mag on public.directory_sync_queue(magazine_id, kind) where status = 'open' and kind in ('needs_decision','error');
create unique index if not exists directory_sync_queue_open_title on public.directory_sync_queue(title_id, kind) where status = 'open' and kind in ('needs_copy','needs_tags');
alter table public.directory_sync_queue enable row level security;

-- Neesh category / subcategory values mapped to Index niche tags.
create table if not exists public.directory_category_map (
  neesh_value text primary key,
  tag_slug text not null
);
alter table public.directory_category_map enable row level security;
insert into public.directory_category_map values
 ('art','art'),('craft','art'),('fashion','fashion'),('food','food'),('interior design','design'),
 ('graphic design','design'),('product design','design'),('literary','literary'),('music','music'),
 ('nightlife','music'),('nature','nature'),('photography','photography'),('queer','identity-politics'),
 ('sports','sport'),('sport','sport'),('travel','travel'),('technology','ideas-science'),('science','ideas-science'),
 ('film','film'),('design','design'),('architecture','design'),('lifestyle','lifestyle'),('news','news')
on conflict (neesh_value) do nothing;

create or replace function public.directory_sync_key(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(regexp_replace(coalesce(p,''), '[^a-zA-Z0-9]', '', 'g')), '(magazine|mag)$', '')
$$;

create or replace function public.directory_sync_domain(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare h text; parts text[]; n int;
begin
  if p is null or btrim(p) = '' then return null; end if;
  h := lower(btrim(p));
  h := regexp_replace(h, '^[a-z]+://', '');
  h := split_part(split_part(split_part(h, '/', 1), '?', 1), '#', 1);
  h := regexp_replace(h, ':\d+$', '');
  h := regexp_replace(h, '^www\.', '');
  if h !~ '\.' then return null; end if;
  parts := string_to_array(h, '.'); n := array_length(parts, 1);
  if n >= 3 and length(parts[n]) = 2 and parts[n-1] in ('co','com','org','net','ac') then
    h := parts[n-2] || '.' || parts[n-1] || '.' || parts[n];
  elsif n >= 2 then
    h := parts[n-1] || '.' || parts[n];
  end if;
  if h in ('instagram.com','linktr.ee','facebook.com','substack.com','bigcartel.com','myshopify.com','shopify.com',
           'etsy.com','squarespace.com','wixsite.com','carrd.co','bandcamp.com','tumblr.com','google.com','gumroad.com',
           'twitter.com','x.com','tiktok.com','notion.site','wordpress.com','blogspot.com','square.site','weebly.com',
           'neesh.art','linkin.bio','beacons.ai') then
    return null;
  end if;
  return h;
end $$;

create or replace function public.directory_sync_slugify(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(lower(coalesce(p,'')), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
$$;

create or replace function public.directory_sync_core_name(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(btrim(split_part(coalesce(p,''), '/', 1)), '\s+magazine$', ''), ',?\s+(inc\.?|llc|ltd\.?)$', '', 'i'))
$$;

create or replace function public.directory_sync_derive_name(p_title text, p_core text, out name text, out confident boolean)
language plpgsql immutable set search_path = '' as $$
declare t text := btrim(coalesce(p_title, '')); s text; ks text; kc text;
begin
  s := regexp_replace(t, '[\s,:;.(–—-]*(\m(issue|vol|volume|edition)\M|№|nº|no\.\s*\d|#\s*\d).*$', '', 'i');
  s := btrim(regexp_replace(s, '[\s,:;–—-]*\(?(19|20)\d{2}\)?$', ''));
  ks := public.directory_sync_key(s); kc := public.directory_sync_key(p_core);
  if kc = '' then
    name := coalesce(nullif(s, ''), t); confident := false;
  elsif ks = '' or ks like kc || '%' or (length(ks) >= 4 and kc like ks || '%') then
    name := p_core; confident := true;
  elsif t ~* '\m(issue|edition|vol|volume)\M' then
    name := p_core; confident := true;
  else
    name := coalesce(nullif(s, ''), t); confident := false;
  end if;
end $$;

create or replace function public.directory_sync_unique_slug(p_base text, p_table text) returns text
language plpgsql set search_path = '' as $$
declare base text := nullif(public.directory_sync_slugify(p_base), ''); cand text; i int := 1; hit boolean;
begin
  if base is null then base := 'title'; end if;
  cand := base;
  loop
    if p_table = 'titles' then
      select exists(select 1 from public.directory_titles where slug = cand) into hit;
    else
      select exists(select 1 from public.directory_publishers where slug = cand) into hit;
    end if;
    exit when not hit;
    i := i + 1; cand := base || '-' || i;
  end loop;
  return cand;
end $$;

-- Recomputes a linked title's availability, current listing and cover from its live Neesh listings.
create or replace function public.directory_sync_refresh_title(p_title uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_latest record; v_any boolean; v_first timestamptz; t record;
begin
  select * into t from public.directory_titles where id = p_title;
  if t.id is null then return; end if;
  select mm.id, mm.cover_image_url into v_latest
  from public.directory_neesh_links l
  join public.magazines mm on mm.id = l.magazine_id
  join public.publishers pp on pp.id = mm.publisher_id
  where l.title_id = p_title and coalesce(mm.is_active, false) and not coalesce(mm.is_demo, false)
    and pp.application_status::text = 'approved'
  order by mm.created_at desc limit 1;
  v_any := v_latest.id is not null;
  select min(mm.created_at) into v_first from public.directory_neesh_links l join public.magazines mm on mm.id = l.magazine_id where l.title_id = p_title;

  update public.directory_titles set
    available_on_neesh = v_any,
    neesh_magazine_id = coalesce(v_latest.id, neesh_magazine_id),
    neesh_listed_at = case when v_any then coalesce(neesh_listed_at, v_first) else neesh_listed_at end
  where id = p_title
    and (available_on_neesh is distinct from v_any
      or (v_latest.id is not null and neesh_magazine_id is distinct from v_latest.id)
      or (v_any and neesh_listed_at is null));

  if t.cover_image_path is null and v_latest.cover_image_url is not null then
    insert into public.directory_cover_sources (slug, url, fetched) values (t.slug, v_latest.cover_image_url, false)
    on conflict (slug) do update set url = excluded.url, error = null
      where public.directory_cover_sources.fetched = false;
  end if;
end $$;

-- The main sync: puts one Neesh listing on the Index, or queues it for review.
create or replace function public.directory_sync_magazine(p_mag uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  m record; p record; app record; dpr record;
  v_email text; v_core text; v_name text; v_conf boolean; v_domain text;
  v_dp_ids uuid[]; v_dp uuid; v_title uuid; v_new_title boolean := false; v_new_pub boolean := false;
  v_prev_linked boolean; v_ntitles int; v_cands jsonb; v_country text; v_city text;
  v_freq public.frequency_type; v_freq_txt text; v_desc text; v_tags int;
begin
  select * into m from public.magazines where id = p_mag;
  if m.id is null then return 'missing'; end if;

  select title_id into v_title from public.directory_neesh_links where magazine_id = p_mag;
  if v_title is not null then
    perform public.directory_sync_refresh_title(v_title);
    return 'refreshed';
  end if;

  select * into p from public.publishers where id = m.publisher_id;
  if p.id is null or p.application_status::text <> 'approved' or not coalesce(m.is_active, false) or coalesce(m.is_demo, false) then
    return 'skipped';
  end if;

  select * into app from public.publisher_applications a where a.user_id = p.user_id order by a.created_at desc limit 1;
  select u.email into v_email from public.users u where u.id = p.user_id;
  v_email := coalesce(v_email, app.email);
  v_core := public.directory_sync_core_name(p.company_name);
  select d.name, d.confident into v_name, v_conf from public.directory_sync_derive_name(m.title, v_core) d;
  v_domain := public.directory_sync_domain(p.website_url);

  select array_agg(distinct x.id) into v_dp_ids from (
    select t.publisher_id as id from public.directory_neesh_links l
      join public.magazines mm on mm.id = l.magazine_id
      join public.directory_titles t on t.id = l.title_id
      where mm.publisher_id = p.id
    union
    select dp.id from public.directory_publishers dp
      where public.directory_sync_key(v_core) <> '' and public.directory_sync_key(dp.name) = public.directory_sync_key(v_core)
    union
    select dp.id from public.directory_publishers dp
      where v_domain is not null and public.directory_sync_domain(dp.website) = v_domain
    union
    select t.publisher_id from public.directory_titles t
      where length(public.directory_sync_key(v_name)) >= 4 and public.directory_sync_key(t.name) = public.directory_sync_key(v_name)
  ) x;

  if coalesce(array_length(v_dp_ids, 1), 0) > 1 then
    select jsonb_agg(jsonb_build_object('publisher', dp.name, 'slug', dp.slug)) into v_cands
      from public.directory_publishers dp where dp.id = any(v_dp_ids);
    insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason, candidates)
      values (m.id, p.id, 'needs_decision', 'Matches more than one Index publisher', v_cands) on conflict do nothing;
    return 'queued';
  end if;

  if coalesce(array_length(v_dp_ids, 1), 0) = 1 then
    v_dp := v_dp_ids[1];
    select * into dpr from public.directory_publishers where id = v_dp;
    if coalesce(dpr.removed, false) or not coalesce(dpr.eligible, true) then
      insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason, candidates)
        values (m.id, p.id, 'needs_decision', 'Matching Index publisher is removed or marked ineligible',
                jsonb_build_array(jsonb_build_object('publisher', dpr.name, 'slug', dpr.slug))) on conflict do nothing;
      return 'queued';
    end if;
    if exists (select 1 from public.directory_titles t where t.publisher_id = v_dp and t.removed
               and public.directory_sync_key(t.name) in (public.directory_sync_key(v_name), public.directory_sync_key(m.title))) then
      insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason)
        values (m.id, p.id, 'needs_decision', 'This title was removed from the Index before') on conflict do nothing;
      return 'queued';
    end if;

    v_prev_linked := exists (select 1 from public.directory_neesh_links l join public.directory_titles t on t.id = l.title_id where t.publisher_id = v_dp);
    select t.id into v_title from public.directory_titles t
      where t.publisher_id = v_dp and not coalesce(t.removed, false)
        and public.directory_sync_key(t.name) in (public.directory_sync_key(v_name), public.directory_sync_key(m.title))
      limit 1;
    if v_title is null then
      select count(*) into v_ntitles from public.directory_titles t where t.publisher_id = v_dp and not coalesce(t.removed, false);
      if v_ntitles = 1 and (v_conf or v_prev_linked) then
        select t.id into v_title from public.directory_titles t where t.publisher_id = v_dp and not coalesce(t.removed, false);
      elsif v_ntitles = 0 or v_conf then
        v_new_title := true;
      else
        select jsonb_agg(jsonb_build_object('title', t.name, 'slug', t.slug)) into v_cands
          from public.directory_titles t where t.publisher_id = v_dp and not coalesce(t.removed, false);
        insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason, candidates)
          values (m.id, p.id, 'needs_decision', 'New product under an Index publisher with several titles; unclear which it belongs to or if it is new', v_cands)
          on conflict do nothing;
        return 'queued';
      end if;
    end if;

    update public.directory_publishers set
      claim_method = case when claimed then claim_method else 'neesh_account' end,
      claimed = true,
      claimed_at = coalesce(claimed_at, now()),
      claimed_email = coalesce(claimed_email, v_email),
      contact_email = coalesce(contact_email, v_email),
      website = coalesce(website, p.website_url)
    where id = v_dp;
  else
    if length(public.directory_sync_key(v_core)) >= 4 or length(public.directory_sync_key(v_name)) >= 4 then
      select jsonb_agg(c) into v_cands from (
        select jsonb_build_object('kind', x.kind, 'name', x.name, 'slug', x.slug) c from (
          select 'publisher' kind, dp.name, dp.slug, public.directory_sync_key(dp.name) k from public.directory_publishers dp
          union all
          select 'title', t.name, t.slug, public.directory_sync_key(t.name) from public.directory_titles t
        ) x
        where length(x.k) >= 4 and (
             (length(public.directory_sync_key(v_core)) >= 4 and (x.k like '%' || public.directory_sync_key(v_core) || '%' or public.directory_sync_key(v_core) like '%' || x.k || '%'))
          or (length(public.directory_sync_key(v_name)) >= 4 and (x.k like '%' || public.directory_sync_key(v_name) || '%' or public.directory_sync_key(v_name) like '%' || x.k || '%')))
        limit 6
      ) z;
    end if;
    if v_cands is not null then
      insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason, candidates)
        values (m.id, p.id, 'needs_decision', 'Close to an existing Index entry; could be a duplicate', v_cands) on conflict do nothing;
      return 'queued';
    end if;
    if not v_conf then
      insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason)
        values (m.id, p.id, 'needs_decision', 'Could not tell the magazine name from the listing title') on conflict do nothing;
      return 'queued';
    end if;

    v_country := upper(coalesce(nullif(btrim(m.origin_country_code), ''), nullif(btrim(app.shipping_country), '')));
    if length(coalesce(v_country, '')) <> 2 then v_country := null; end if;
    v_city := nullif(btrim(app.shipping_city), '');
    insert into public.directory_publishers (name, slug, website, contact_email, country, city, eligible, claimed, claimed_at, claimed_email, claim_method, created_from)
      values (v_core, public.directory_sync_unique_slug(v_core, 'publishers'), p.website_url, v_email, v_country, v_city, true, true, now(), v_email, 'neesh_account', 'admin_created')
      returning id into v_dp;
    v_new_pub := true;
    v_new_title := true;
  end if;

  if v_new_title then
    select * into dpr from public.directory_publishers where id = v_dp;
    v_freq_txt := lower(btrim(coalesce(m.issue_frequency, app.issue_frequency, '')));
    v_freq_txt := case v_freq_txt
      when 'biannually' then 'biannual' when 'bi-annual' then 'biannual' when 'semiannual' then 'biannual' when 'semi-annual' then 'biannual'
      when 'annually' then 'annual' when 'yearly' then 'annual' when 'bi-monthly' then 'bimonthly' when 'one-off' then 'evergreen'
      when 'one off' then 'evergreen' else v_freq_txt end;
    begin
      v_freq := nullif(v_freq_txt, '')::public.frequency_type;
    exception when others then v_freq := null;
    end;
    v_desc := coalesce(nullif(btrim(m.description), ''), nullif(btrim(p.description), ''));
    insert into public.directory_titles (publisher_id, name, slug, description, frequency, page_count, country, city, status, created_from)
      values (v_dp, v_name, public.directory_sync_unique_slug(v_name, 'titles'), v_desc, v_freq, m.page_count,
              dpr.country, dpr.city, 'active', 'admin_created')
      returning id into v_title;

    insert into public.directory_title_tags (title_id, tag_id)
      select v_title, tg.id from public.directory_tags tg
      join public.directory_category_map cm on cm.tag_slug = tg.slug
      where cm.neesh_value in (lower(btrim(coalesce(m.category, ''))), lower(btrim(coalesce(m.subcategory, ''))))
      on conflict do nothing;
    get diagnostics v_tags = row_count;
    if v_tags = 0 then
      insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, title_id, kind, reason)
        values (m.id, p.id, v_title, 'needs_tags', 'No Index niche could be mapped from the listing category') on conflict do nothing;
    end if;
    insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, title_id, kind, reason)
      values (m.id, p.id, v_title, 'needs_copy',
              case when v_desc is null then 'No description yet' else 'Description is the publisher''s own copy; rewrite for readers and stockists' end)
      on conflict do nothing;
  end if;

  insert into public.directory_neesh_links (magazine_id, title_id, link_method)
    values (m.id, v_title, case when v_new_pub then 'created' when v_new_title then 'created_title' else 'matched' end)
    on conflict (magazine_id) do nothing;
  perform public.directory_sync_refresh_title(v_title);
  return case when v_new_pub then 'created' when v_new_title then 'created_title' else 'linked' end;
end $$;

-- Manual override for queue decisions: attach a listing to a chosen Index title.
create or replace function public.directory_sync_force_link(p_mag uuid, p_title uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_dp uuid; v_email text;
begin
  select t.publisher_id into v_dp from public.directory_titles t where t.id = p_title;
  if v_dp is null then raise exception 'No Index title %', p_title; end if;
  select u.email into v_email from public.magazines mm join public.publishers pp on pp.id = mm.publisher_id
    left join public.users u on u.id = pp.user_id where mm.id = p_mag;
  insert into public.directory_neesh_links (magazine_id, title_id, link_method) values (p_mag, p_title, 'manual')
    on conflict (magazine_id) do update set title_id = excluded.title_id, link_method = 'manual', linked_at = now();
  update public.directory_publishers set
    claim_method = case when claimed then claim_method else 'neesh_account' end,
    claimed = true, claimed_at = coalesce(claimed_at, now()), claimed_email = coalesce(claimed_email, v_email)
  where id = v_dp;
  update public.directory_sync_queue set status = 'resolved', resolved_at = now()
    where magazine_id = p_mag and status = 'open' and kind in ('needs_decision','error');
  perform public.directory_sync_refresh_title(p_title);
  return 'linked';
end $$;

-- Seed links from titles already connected by hand.
insert into public.directory_neesh_links (magazine_id, title_id, link_method)
select t.neesh_magazine_id, t.id, 'existing'
from public.directory_titles t join public.magazines mm on mm.id = t.neesh_magazine_id
where t.neesh_magazine_id is not null
on conflict (magazine_id) do nothing;

revoke all on function public.directory_sync_refresh_title(uuid) from public, anon, authenticated;
revoke all on function public.directory_sync_magazine(uuid) from public, anon, authenticated;
revoke all on function public.directory_sync_force_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.directory_sync_unique_slug(text, text) from public, anon, authenticated;
;
