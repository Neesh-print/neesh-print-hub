-- Move blocklist + dial-level filtering inside the submit RPC so the requester's
-- blocklist is never exposed to submitters or route code. Shredded text is never stored.
create or replace function odditt_submit(
  p_slug text, p_sliders jsonb, p_choice text, p_madlib jsonb,
  p_freetext text, p_status text, p_ip_hash text
) returns json language plpgsql security definer set search_path = public as $$
declare v_req odditt_requests; v_count int; v_status text; v_recent int; v_text text; v_term text;
begin
  select * into v_req from odditt_requests where slug = p_slug;
  if v_req.id is null then return json_build_object('error','not_found'); end if;

  select count(*) into v_count from odditt_submissions where request_id = v_req.id;
  if v_count >= 100 then return json_build_object('error','capped'); end if;

  if p_ip_hash is not null then
    select count(*) into v_recent from odditt_submissions
      where request_id = v_req.id and ip_hash = p_ip_hash;
    if v_recent >= 3 then return json_build_object('error','rate_limited'); end if;
  end if;

  v_status := case when p_status in ('none','pending','shredded') then p_status else 'pending' end;
  v_text := nullif(trim(coalesce(p_freetext,'')), '');
  if v_text is null and v_status = 'pending' then v_status := 'none'; end if;

  -- requester blocklist (case-insensitive substring)
  if v_status = 'pending' and v_text is not null then
    foreach v_term in array v_req.blocklist loop
      if v_term is not null and length(trim(v_term)) > 0 and v_text ilike '%' || trim(v_term) || '%' then
        v_status := 'shredded';
        exit;
      end if;
    end loop;
  end if;

  -- dial-level cruelty wordlist (v0 approximation; classifier arrives in Phase 3)
  if v_status = 'pending' and v_text is not null and v_req.dial <> 'unfiltered' then
    if v_text ~* '\m(fat|obese|ugly|hideous|worthless|pathetic|loser)\M'
       or v_text ~* 'nobody (likes|loves) (you|them|her|him)'
       or v_text ~* 'waste of (space|air)' then
      v_status := 'shredded';
    end if;
  end if;

  insert into odditt_submissions(request_id, sliders, choice, madlib, freetext, freetext_status, ip_hash)
  values (
    v_req.id,
    coalesce(p_sliders, '{}'::jsonb),
    nullif(trim(coalesce(p_choice,'')), ''),
    p_madlib,
    case when v_status in ('shredded','none') then null else v_text end,
    v_status,
    p_ip_hash
  );
  return json_build_object('ok', true, 'shredded', v_status = 'shredded');
end $$;;
