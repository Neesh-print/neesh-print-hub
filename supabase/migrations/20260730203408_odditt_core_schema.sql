-- Odditt v0: isolated tables (odditt_ prefix) + security-definer RPCs.
-- Tables are RLS-locked with no policies; all access goes through the functions below.

create table if not exists odditt_requests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  admin_token text unique not null,
  name text not null,
  template text not null,
  dial text not null default 'standard',
  blocklist text[] not null default '{}',
  email text,
  created_at timestamptz not null default now()
);

create table if not exists odditt_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references odditt_requests(id) on delete cascade,
  sliders jsonb not null default '{}'::jsonb,
  choice text,
  madlib jsonb,
  freetext text,
  freetext_status text not null default 'none', -- none | pending | released | shredded
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists odditt_submissions_request_idx on odditt_submissions(request_id);

alter table odditt_requests enable row level security;
alter table odditt_submissions enable row level security;

create or replace function odditt_create_request(
  p_name text, p_template text, p_dial text, p_blocklist text[], p_email text
) returns json language plpgsql security definer set search_path = public as $$
declare v_slug text; v_token text;
begin
  if p_name is null or length(trim(p_name)) < 1 or length(p_name) > 40 then
    return json_build_object('error','bad_name');
  end if;
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]', '', 'g'));
  if length(v_slug) < 1 then v_slug := 'friend'; end if;
  v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  v_token := replace(gen_random_uuid()::text, '-', '') || substr(md5(gen_random_uuid()::text), 1, 8);
  insert into odditt_requests(slug, admin_token, name, template, dial, blocklist, email)
  values (v_slug, v_token, trim(p_name), p_template, coalesce(p_dial,'standard'), coalesce(p_blocklist,'{}'), nullif(trim(coalesce(p_email,'')), ''));
  return json_build_object('slug', v_slug, 'admin_token', v_token);
end $$;

create or replace function odditt_get_request(p_slug text)
returns json language sql security definer stable set search_path = public as $$
  select json_build_object('name', name, 'template', template)
  from odditt_requests where slug = p_slug;
$$;

create or replace function odditt_submit(
  p_slug text, p_sliders jsonb, p_choice text, p_madlib jsonb,
  p_freetext text, p_status text, p_ip_hash text
) returns json language plpgsql security definer set search_path = public as $$
declare v_req odditt_requests; v_count int; v_status text; v_recent int;
begin
  select * into v_req from odditt_requests where slug = p_slug;
  if v_req.id is null then return json_build_object('error','not_found'); end if;

  select count(*) into v_count from odditt_submissions where request_id = v_req.id;
  if v_count >= 100 then return json_build_object('error','capped'); end if;

  -- naive per-IP rate limit: max 3 submissions per request per ip_hash
  if p_ip_hash is not null then
    select count(*) into v_recent from odditt_submissions
      where request_id = v_req.id and ip_hash = p_ip_hash;
    if v_recent >= 3 then return json_build_object('error','rate_limited'); end if;
  end if;

  v_status := case when p_status in ('none','pending','shredded') then p_status else 'pending' end;

  insert into odditt_submissions(request_id, sliders, choice, madlib, freetext, freetext_status, ip_hash)
  values (
    v_req.id,
    coalesce(p_sliders, '{}'::jsonb),
    nullif(trim(coalesce(p_choice,'')), ''),
    p_madlib,
    case when v_status = 'shredded' then null else nullif(trim(coalesce(p_freetext,'')), '') end,
    v_status,
    p_ip_hash
  );
  return json_build_object('ok', true);
end $$;

create or replace function odditt_get_results(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_req odditt_requests; v_quorum int; v_result json;
begin
  select * into v_req from odditt_requests where admin_token = p_token;
  if v_req.id is null then return json_build_object('error','not_found'); end if;

  -- release pending free text once quorum of 3 written responses exists
  select count(*) into v_quorum from odditt_submissions
    where request_id = v_req.id and freetext_status in ('pending','released');
  if v_quorum >= 3 then
    update odditt_submissions set freetext_status = 'released'
      where request_id = v_req.id and freetext_status = 'pending';
  end if;

  select json_build_object(
    'name', v_req.name,
    'template', v_req.template,
    'slug', v_req.slug,
    'dial', v_req.dial,
    'count', (select count(*) from odditt_submissions where request_id = v_req.id),
    'sliders', (
      select coalesce(json_object_agg(k, v), '{}'::json) from (
        select key as k, round(avg((value)::numeric), 1) as v
        from odditt_submissions s, jsonb_each_text(s.sliders)
        where s.request_id = v_req.id
        group by key
      ) t
    ),
    'choices', (
      select coalesce(json_object_agg(choice, n), '{}'::json) from (
        select choice, count(*) as n from odditt_submissions
        where request_id = v_req.id and choice is not null
        group by choice
      ) c
    ),
    'quotes', (
      select coalesce(json_agg(json_build_object('id', id, 'text', freetext) order by md5(id::text)), '[]'::json)
      from odditt_submissions
      where request_id = v_req.id and freetext_status = 'released'
    ),
    'held', (select count(*) from odditt_submissions where request_id = v_req.id and freetext_status = 'pending'),
    'shredded', (select count(*) from odditt_submissions where request_id = v_req.id and freetext_status = 'shredded'),
    'madlibs', (
      select coalesce(json_agg(madlib order by md5(id::text)), '[]'::json)
      from odditt_submissions
      where request_id = v_req.id and madlib is not null
    )
  ) into v_result;
  return v_result;
end $$;;
