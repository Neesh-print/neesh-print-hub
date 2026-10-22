-- Checkout failure alerts.
--
-- Oct 21 2026: the first real order on Neesh was blocked by a CORS
-- allowlist in create-checkout, and we only found out because the buyer
-- emailed a screenshot. The app now records every failed checkout here
-- (straight to the database, so it still works when an edge function is
-- unreachable) and this trigger emails hi@neesh.art immediately.

CREATE TABLE IF NOT EXISTS public.checkout_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source text NOT NULL,               -- 'cart' or 'checkout' page
  error_code text,
  error_message text,
  cart jsonb,                         -- [{title, quantity}]
  cart_total numeric,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users log their own checkout failures" ON public.checkout_failures;
CREATE POLICY "Users log their own checkout failures"
  ON public.checkout_failures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read checkout failures" ON public.checkout_failures;
CREATE POLICY "Admins read checkout failures"
  ON public.checkout_failures FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS checkout_failures_user_created_idx
  ON public.checkout_failures (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_checkout_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_key text;
  v_from text;
  v_email text;
  v_shop text;
  v_city text;
  v_items text;
  v_html text;
begin
  -- One email per buyer per 10 minutes, so retries don't flood the inbox.
  if exists (
    select 1 from public.checkout_failures f
    where f.user_id = new.user_id
      and f.id <> new.id
      and f.created_at > now() - interval '10 minutes'
  ) then
    return new;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'RESEND_API_KEY' limit 1;
  select decrypted_secret into v_from from vault.decrypted_secrets where name = 'NOTIFICATION_FROM_EMAIL' limit 1;
  if v_key is null then
    raise notice 'RESEND_API_KEY missing in vault, skipping checkout alert for %', new.id;
    return new;
  end if;
  v_from := coalesce(v_from, 'Neesh <onboarding@resend.dev>');

  select u.email into v_email from public.users u where u.id = new.user_id;
  select r.shop_name, concat_ws(', ', nullif(r.city, ''), nullif(r.state, ''))
    into v_shop, v_city
    from public.retailers r where r.user_id = new.user_id limit 1;

  select string_agg(
           '<li>' || coalesce(i->>'quantity', '?') || ' x ' || coalesce(i->>'title', 'untitled') || '</li>', '')
    into v_items
    from jsonb_array_elements(coalesce(new.cart, '[]'::jsonb)) i;

  v_html :=
    '<div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">'
    || '<p style="margin:0 0 16px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#b91c1c">Checkout failed</p>'
    || '<p style="margin:0 0 4px"><strong>' || coalesce(v_shop, 'Unknown shop') || '</strong>'
    || case when coalesce(v_city, '') <> '' then ' (' || v_city || ')' else '' end || '</p>'
    || '<p style="margin:0 0 16px">' || coalesce(v_email, 'no email') || '</p>'
    || '<p style="margin:0 0 4px">Cart total: $' || coalesce(to_char(new.cart_total, 'FM999,990.00'), 'n/a') || '</p>'
    || '<ul style="margin:0 0 16px;padding-left:20px">' || coalesce(v_items, '<li>no items recorded</li>') || '</ul>'
    || '<p style="margin:0 0 4px">Error: ' || coalesce(nullif(new.error_message, ''), 'none given')
    || case when coalesce(new.error_code, '') <> '' then ' (' || new.error_code || ')' else '' end || '</p>'
    || '<p style="margin:0 0 16px">Page: ' || new.source || '</p>'
    || '<p style="margin:0;font-size:13px;color:#666">Reply to this email to reach the buyer. Logged '
    || to_char(now() at time zone 'America/New_York', 'Mon DD YYYY, HH12:MI AM') || ' ET, id ' || new.id || '</p>'
    || '</div>';

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object(
      'from', v_from,
      'to', jsonb_build_array('hi@neesh.art'),
      'reply_to', coalesce(v_email, 'hi@neesh.art'),
      'subject', 'Checkout failed: ' || coalesce(v_shop, v_email, 'a retailer')
                 || ' ($' || coalesce(to_char(new.cart_total, 'FM999,990.00'), '?') || ')',
      'html', v_html
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise notice 'checkout alert failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_checkout_failure ON public.checkout_failures;
CREATE TRIGGER on_checkout_failure
  AFTER INSERT ON public.checkout_failures
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_checkout_failure();
