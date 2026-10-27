-- Odditt accounts: magic-link auth, sessions, claim-by-admin-token
create table if not exists public.odditt_accounts (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);
create table if not exists public.odditt_login_tokens (
  token text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create table if not exists public.odditt_sessions (
  token text primary key,
  account_id uuid not null references public.odditt_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.odditt_requests add column if not exists account_id uuid;

alter table public.odditt_accounts enable row level security;
alter table public.odditt_login_tokens enable row level security;
alter table public.odditt_sessions enable row level security;

-- Create a login token (rate-limited: max 5 per email per hour)
create or replace function public.odditt_create_login_token(p_email text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_recent int;
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254 then
    return jsonb_build_object('error','bad_email');
  end if;
  select count(*) into v_recent from odditt_login_tokens
    where email = lower(p_email) and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    return jsonb_build_object('error','rate_limited');
  end if;
  insert into odditt_login_tokens(token, email, expires_at)
    values (p_token, lower(p_email), now() + interval '30 minutes');
  return jsonb_build_object('ok', true);
end $$;

-- Consume a login token: upsert account, create session
create or replace function public.odditt_consume_login_token(p_token text, p_session text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; v_account uuid;
begin
  update odditt_login_tokens set used_at = now()
    where token = p_token and used_at is null and expires_at > now()
    returning email into v_email;
  if v_email is null then
    return jsonb_build_object('error','invalid_or_expired');
  end if;
  insert into odditt_accounts(email) values (v_email)
    on conflict (email) do update set email = excluded.email
    returning id into v_account;
  insert into odditt_sessions(token, account_id) values (p_session, v_account);
  return jsonb_build_object('ok', true, 'email', v_email);
end $$;

-- Resolve a session to an account
create or replace function public.odditt_session_account(p_session text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_email text;
begin
  select s.account_id, a.email into v_account, v_email
    from odditt_sessions s join odditt_accounts a on a.id = s.account_id
    where s.token = p_session and s.created_at > now() - interval '365 days';
  if v_account is null then
    return jsonb_build_object('error','no_session');
  end if;
  update odditt_sessions set last_seen = now() where token = p_session;
  return jsonb_build_object('ok', true, 'email', v_email);
end $$;

-- Claim a review (by its private admin token) into the session's account
create or replace function public.odditt_claim_review(p_session text, p_admin_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_slug text;
begin
  select account_id into v_account from odditt_sessions
    where token = p_session and created_at > now() - interval '365 days';
  if v_account is null then
    return jsonb_build_object('error','no_session');
  end if;
  update odditt_requests set account_id = v_account
    where admin_token = p_admin_token and (account_id is null or account_id = v_account)
    returning slug into v_slug;
  if v_slug is null then
    return jsonb_build_object('error','not_claimable');
  end if;
  return jsonb_build_object('ok', true, 'slug', v_slug);
end $$;

-- List the session account's reviews (owner sees their own admin tokens)
create or replace function public.odditt_account_reviews(p_session text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_email text; v_reviews jsonb;
begin
  select s.account_id, a.email into v_account, v_email
    from odditt_sessions s join odditt_accounts a on a.id = s.account_id
    where s.token = p_session and s.created_at > now() - interval '365 days';
  if v_account is null then
    return jsonb_build_object('error','no_session');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', r.slug, 'name', r.name, 'template', r.template,
      'token', r.admin_token, 'created', r.created_at,
      'count', (select count(*) from odditt_submissions su where su.request_id = r.id)
    ) order by r.created_at desc), '[]'::jsonb)
    into v_reviews
    from odditt_requests r where r.account_id = v_account;
  return jsonb_build_object('ok', true, 'email', v_email, 'reviews', v_reviews);
end $$;;
