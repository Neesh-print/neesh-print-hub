alter table odditt_submissions
  add column if not exists rapidfire jsonb,
  add column if not exists choices jsonb,
  add column if not exists texts jsonb,
  add column if not exists texts_status text not null default 'none',
  add column if not exists shredded_texts int not null default 0;

create or replace function odditt_submit_v2(
  p_slug text, p_sliders jsonb, p_choices jsonb, p_madlib jsonb,
  p_texts jsonb, p_rapidfire jsonb, p_shredded_by_floor int, p_ip_hash text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_req odditt_requests; v_count int; v_recent int;
  v_texts jsonb := '{}'::jsonb; v_shred int := coalesce(p_shredded_by_floor, 0);
  v_key text; v_val text; v_blocked boolean; v_term text; v_status text;
begin
  select * into v_req from odditt_requests where slug = p_slug;
  if v_req.id is null then return json_build_object('error','not_found'); end if;

  select count(*) into v_count from odditt_submissions where request_id = v_req.id;
  if v_count >= 150 then return json_build_object('error','capped'); end if;

  if p_ip_hash is not null then
    select count(*) into v_recent from odditt_submissions
      where request_id = v_req.id and ip_hash = p_ip_hash;
    if v_recent >= 3 then return json_build_object('error','rate_limited'); end if;
  end if;

  -- per-text blocklist + dial filtering; shredded text is never stored
  if p_texts is not null then
    for v_key, v_val in select key, value from jsonb_each_text(p_texts) loop
      v_val := nullif(trim(coalesce(v_val,'')), '');
      if v_val is null then continue; end if;
      v_blocked := false;
      foreach v_term in array v_req.blocklist loop
        if v_term is not null and length(trim(v_term)) > 0 and v_val ilike '%' || trim(v_term) || '%' then
          v_blocked := true; exit;
        end if;
      end loop;
      if not v_blocked and v_req.dial <> 'unfiltered' then
        if v_val ~* '\m(fat|obese|ugly|hideous|worthless|pathetic|loser)\M'
           or v_val ~* 'nobody (likes|loves) (you|them|her|him)'
           or v_val ~* 'waste of (space|air)' then
          v_blocked := true;
        end if;
      end if;
      if v_blocked then v_shred := v_shred + 1;
      else v_texts := v_texts || jsonb_build_object(v_key, v_val);
      end if;
    end loop;
  end if;

  v_status := case when v_texts = '{}'::jsonb then 'none' else 'pending' end;

  insert into odditt_submissions(request_id, sliders, choices, madlib, texts, texts_status, rapidfire, shredded_texts, ip_hash)
  values (v_req.id, coalesce(p_sliders,'{}'::jsonb), p_choices, p_madlib, v_texts, v_status, p_rapidfire, v_shred, p_ip_hash);
  return json_build_object('ok', true, 'shredded', v_shred > 0);
end $$;

create or replace function odditt_get_results(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_req odditt_requests; v_quorum int; v_result json;
begin
  select * into v_req from odditt_requests where admin_token = p_token;
  if v_req.id is null then return json_build_object('error','not_found'); end if;

  select count(*) into v_quorum from odditt_submissions
    where request_id = v_req.id
      and (freetext_status in ('pending','released') or texts_status in ('pending','released'));
  if v_quorum >= 3 then
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
        from odditt_submissions where request_id = v_req.id and freetext_status = 'released' and freetext is not null
      ) x
    ),
    'held', (select count(*) from odditt_submissions where request_id = v_req.id and (freetext_status = 'pending' or texts_status = 'pending')),
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
end $$;;
