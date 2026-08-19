-- Publisher applications: persist pricing, and notify on submit rather than on insert.
--
-- Two defects this fixes:
--   1. update_publisher_application never mapped wholesale_price,
--      suggested_retail_price, or available_quantity, so anything the wizard
--      collected for those columns was silently dropped on submit.
--   2. notify_publisher_application fired AFTER INSERT. The wizard inserts a
--      near-empty row at step 1 and fills it in via later updates, so the
--      admin email was always a snapshot of a blank application ("untitled",
--      "Business: not given", "Link: not given"). It now fires when the
--      application actually reaches 'submitted'.

-- 1. Persist the pricing columns through the anonymous-applicant RPC.
--    Values are guarded by a numeric regex so a malformed input can't abort
--    the whole submission with a cast error.
CREATE OR REPLACE FUNCTION public.update_publisher_application(p_id uuid, p_token uuid, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.publisher_applications
  SET
    first_name = COALESCE(NULLIF((p_data->>'firstName')::text, ''), first_name),
    last_name = COALESCE(NULLIF((p_data->>'lastName')::text, ''), last_name),
    email = COALESCE(NULLIF((p_data->>'email')::text, ''), email),
    business_name = COALESCE(NULLIF((p_data->>'businessName')::text, ''), business_name),
    magazine_title = COALESCE(NULLIF((p_data->>'magazineTitle')::text, ''), magazine_title),
    cover_image_url = COALESCE(NULLIF((p_data->>'coverImageUrl')::text, ''), cover_image_url),
    description = COALESCE(NULLIF((p_data->>'description')::text, ''), description),
    social_website_link = COALESCE(NULLIF((p_data->>'websiteUrl')::text, ''), social_website_link),
    instagram_handle = COALESCE(NULLIF((p_data->>'instagramHandle')::text, ''), instagram_handle),
    shipping_country = COALESCE(NULLIF((p_data->>'shippingCountry')::text, ''), shipping_country),
    shipping_city = COALESCE(NULLIF((p_data->>'shippingCity')::text, ''), shipping_city),
    issue_frequency = COALESCE(NULLIF((p_data->>'issueFrequency')::text, ''), issue_frequency),
    publication_type = COALESCE(NULLIF((p_data->>'publicationType')::text, ''), publication_type),
    distribution_channels = (CASE
      WHEN p_data ? 'regionsCurrentlySold' AND jsonb_typeof(p_data->'regionsCurrentlySold') = 'array' THEN
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'regionsCurrentlySold') t(x)), '{}'::text[])
      ELSE distribution_channels
    END),
    fulfillment_method = COALESCE(NULLIF((p_data->>'fulfillmentMethod')::text, ''), fulfillment_method),
    quotes_feedback = COALESCE(NULLIF((p_data->>'cloudLink')::text, ''), quotes_feedback),
    wholesale_price = COALESCE(
      CASE WHEN p_data->>'wholesalePrice' ~ '^[0-9]+(\.[0-9]+)?$'
           THEN (p_data->>'wholesalePrice')::numeric END,
      wholesale_price),
    suggested_retail_price = COALESCE(
      CASE WHEN p_data->>'suggestedRetailPrice' ~ '^[0-9]+(\.[0-9]+)?$'
           THEN (p_data->>'suggestedRetailPrice')::numeric END,
      suggested_retail_price),
    available_quantity = COALESCE(
      CASE WHEN p_data->>'availableQuantity' ~ '^[0-9]+$'
           THEN (p_data->>'availableQuantity')::integer END,
      available_quantity),
    additional_info = COALESCE(p_data, additional_info),
    -- Handle status update if provided (submission)
    status = COALESCE(p_data->>'status', status),
    submitted_at = (CASE WHEN (p_data->>'status') = 'submitted' THEN NOW() ELSE submitted_at END)
  WHERE id = p_id AND access_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or invalid token';
  END IF;
END;
$function$;

-- 2. Only notify once the application actually reaches 'submitted'.
--    The email body is unchanged; it just runs against a filled-in row now.
CREATE OR REPLACE FUNCTION public.notify_publisher_application()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  v_key text;
  v_from text;
  v_html text;
begin
  -- Fire only on the transition into 'submitted', from either an update
  -- (the wizard's normal path) or an insert that already carries that status.
  if new.status is distinct from 'submitted' then
    return new;
  end if;
  if TG_OP = 'UPDATE' and old.status is not distinct from 'submitted' then
    return new;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'RESEND_API_KEY' limit 1;
  select decrypted_secret into v_from from vault.decrypted_secrets where name = 'NOTIFICATION_FROM_EMAIL' limit 1;

  if v_key is null then
    raise notice 'RESEND_API_KEY missing in vault, skipping notification for %', new.id;
    return new;
  end if;

  v_from := coalesce(v_from, 'Neesh <onboarding@resend.dev>');

  v_html :=
    '<div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">'
    || '<p style="margin:0 0 16px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b21a8">New publisher application</p>'
    || '<p style="margin:0 0 4px"><strong>' || coalesce(new.magazine_title, 'Untitled') || '</strong>'
    || case when coalesce(new.issue_number, '') <> '' then ', issue ' || new.issue_number else '' end || '</p>'
    || '<p style="margin:0 0 16px">' || coalesce(nullif(concat_ws(' ', new.first_name, new.last_name), ''), '')
    || ' &lt;' || coalesce(new.email, 'no email') || '&gt;</p>'
    || '<p style="margin:0 0 4px">Business: ' || coalesce(nullif(new.business_name, ''), 'not given') || '</p>'
    || '<p style="margin:0 0 4px">Link: ' || coalesce(nullif(new.social_website_link, ''), 'not given') || '</p>'
    || '<p style="margin:0 0 4px">Instagram: ' || coalesce(nullif(new.instagram_handle, ''), 'not given') || '</p>'
    || '<p style="margin:0 0 4px">Wholesale ' || coalesce(new.wholesale_price::text, 'n/a') || ' / retail ' || coalesce(new.suggested_retail_price::text, 'n/a') || '</p>'
    || '<p style="margin:0 0 16px">Qty available: ' || coalesce(new.available_quantity::text, 'not given') || '</p>'
    || '<p style="margin:0;font-size:13px;color:#666">Application ' || new.id
    || ' at ' || to_char(now() at time zone 'America/Los_Angeles', 'Mon DD YYYY, HH12:MI AM') || ' PT</p>'
    || '</div>';

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object(
      'from', v_from,
      'to', jsonb_build_array('hi@neesh.art'),
      'reply_to', coalesce(new.email, 'hi@neesh.art'),
      'subject', 'New publisher application: ' || coalesce(new.magazine_title, 'untitled'),
      'html', v_html
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise notice 'publisher notification failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_publisher_application_created ON public.publisher_applications;
DROP TRIGGER IF EXISTS on_publisher_application_submitted ON public.publisher_applications;
CREATE TRIGGER on_publisher_application_submitted
  AFTER INSERT OR UPDATE ON public.publisher_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_publisher_application();
