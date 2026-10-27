-- 0003: quorum 3 -> 2 writers, plus an event detail column and a wider event allowlist.
-- Three writers proved unreachable at real-world volume: only one review in the
-- app's history ever cleared it, so the written feedback people actually come for
-- stayed dark. Two still prevents the single-author case.

alter table public.odditt_events add column if not exists detail text;

drop function if exists public.odditt_track(text, text, text);

create or replace function public.odditt_track(
  p_name text, p_slug text, p_template text, p_detail text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_allowed text[] := array[
  'r_view','r_start','r_filed','loop_click',
  'new_view','new_created','results_view','me_view','signin_requested',
  'confirm_view','share_native','share_native_fail','share_dismissed',
  'copy_ok','copy_fail','card_share',
  'new_blocked_name','new_blocked_adult','new_blocked_fewq',
  'rage_click','email_prompted','email_sent'
];
begin
  if p_name is null or not (p_name = any(v_allowed)) then
    return jsonb_build_object('error','bad_event');
  end if;
  insert into odditt_events(name, slug, template, detail)
  values (p_name, left(nullif(p_slug,''), 40), left(nullif(p_template,''), 20),
          left(nullif(p_detail,''), 40));
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.odditt_get_results(p_token text)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare v_req odditt_requests; v_quorum int; v_result json;
begin
  select * into v_req from odditt_requests where admin_token = p_token;
  if v_req.id is null then return json_build_object('error','not_found'); end if;

  select count(*) into v_quorum from odditt_submissions
    where request_id = v_req.id
      and (freetext_status in ('pending','released') or texts_status in ('pending','released'));
  if v_quorum >= 2 then
    update odditt_submissions set freetext_status = 'released'
      where request_id = v_req.id and freetext_status = 'pending';
    update odditt_submissions set texts_status = 'released'
      where request_id = v_req.id and texts_status = 'pending';
  end if;

  select json_build_object(
    'name', v_req.name, 'template', v_req.template, 'slug', v_req.slug, 'dial', v_req.dial,
    'count', (select count(*) from odditt_submissions where request_id = v_req.id),
    'sliders', (
      select coalesce(json_object_agg(k, v), '{}'::json) from (
        select key as k, round(avg((value)::numeric), 1) as v
        from odditt_submissions s, jsonb_each_text(s.sliders)
        where s.request_id = v_req.id group by key
      ) t
    ),
    'choices', (
      select coalesce(json_object_agg(ck, opts), '{}'::json) from (
        select ck, json_object_agg(opt, n) as opts from (
          select key as ck, value as opt, count(*) as n
          from odditt_submissions s, jsonb_each_text(s.choices)
          where s.request_id = v_req.id group by key, value
          union all
          select 'legacy' as ck, choice as opt, count(*) as n
          from odditt_submissions where request_id = v_req.id and choice is not null group by choice
        ) u group by ck
      ) c
    ),
    'rapidfire', (
      select coalesce(json_object_agg(rk, json_build_object('yes', yes, 'total', total)), '{}'::json) from (
        select key as rk,
               count(*) filter (where value = 'true') as yes,
               count(*) as total
        from odditt_submissions s, jsonb_each_text(s.rapidfire)
        where s.request_id = v_req.id group by key
      ) r
    ),
    'texts', (
      select coalesce(json_agg(json_build_object('key', tk, 'text', tv) order by md5(tv)), '[]'::json) from (
        select key as tk, value as tv
        from odditt_submissions s, jsonb_each_text(s.texts)
        where s.request_id = v_req.id and s.texts_status = 'released'
        union all
        select 'legacy' as tk, freetext as tv
        from odditt_submissions where request_id = v_req.id
          and freetext_status = 'released' and freetext is not null
      ) x
    ),
    'held', (select count(*) from odditt_submissions
             where request_id = v_req.id and (freetext_status = 'pending' or texts_status = 'pending')),
    'shredded', (
      (select count(*) from odditt_submissions where request_id = v_req.id and freetext_status = 'shredded')
      + (select coalesce(sum(shredded_texts),0) from odditt_submissions where request_id = v_req.id)
    ),
    'madlibs', (
      select coalesce(json_agg(madlib order by md5(id::text)), '[]'::json)
      from odditt_submissions where request_id = v_req.id and madlib is not null
    )
  ) into v_result;
  return v_result;
end $function$;;
