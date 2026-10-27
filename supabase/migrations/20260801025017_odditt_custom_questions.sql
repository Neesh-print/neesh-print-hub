-- Requester-authored question edits: which built-ins are switched off,
-- plus up to 3 added 0-10 questions. Validated server-side because these
-- strings are shown to other people.
alter table public.odditt_requests add column if not exists custom jsonb;

create or replace function public.odditt_create_request_v2(
  p_name text, p_template text, p_dial text, p_blocklist text[],
  p_email text, p_custom jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_off jsonb; v_sliders jsonb; v_clean jsonb; v_item jsonb; v_out jsonb := '[]'::jsonb;
  v_base jsonb; v_res jsonb;
begin
  v_off := coalesce(p_custom->'off', '[]'::jsonb);
  v_sliders := coalesce(p_custom->'sliders', '[]'::jsonb);

  if jsonb_typeof(v_off) <> 'array' or jsonb_typeof(v_sliders) <> 'array' then
    return jsonb_build_object('error','bad_custom');
  end if;
  if jsonb_array_length(v_off) > 40 or jsonb_array_length(v_sliders) > 3 then
    return jsonb_build_object('error','too_many_custom');
  end if;

  -- Normalise added questions; drop anything without a usable label.
  for v_item in select * from jsonb_array_elements(v_sliders) loop
    if coalesce(trim(v_item->>'label'), '') <> '' then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'key', 'c_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8),
        'label', left(trim(v_item->>'label'), 70),
        'lo', left(coalesce(nullif(trim(v_item->>'lo'), ''), 'not at all'), 40),
        'hi', left(coalesce(nullif(trim(v_item->>'hi'), ''), 'completely'), 40)
      ));
    end if;
  end loop;

  v_clean := jsonb_build_object('off', v_off, 'sliders', v_out);

  -- Reuse the existing creation path, then attach the custom block.
  v_base := to_jsonb(public.odditt_create_request(p_name, p_template, p_dial, p_blocklist, p_email));
  if v_base ? 'error' then return v_base; end if;

  update odditt_requests set custom = v_clean where slug = v_base->>'slug';
  return v_base;
end $$;

create or replace function public.odditt_get_request(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', name, 'template', template, 'custom', custom)
  from odditt_requests where slug = p_slug;
$$;;
