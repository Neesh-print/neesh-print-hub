CREATE OR REPLACE FUNCTION public.due_profile_reminders()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  company_name text,
  profile_slug text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    u.email,
    COALESCE(NULLIF(pr.full_name, ''), p.company_name, 'there') AS name,
    p.company_name,
    p.profile_slug
  FROM public.publishers p
  JOIN public.users u ON u.id = p.user_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.application_status = 'approved'
    AND p.profile_reminder_sent_at IS NULL
    AND p.verified_at IS NOT NULL
    AND p.verified_at <= now() - interval '7 days'
    AND u.email IS NOT NULL
    AND u.email <> ''
    AND u.email NOT ILIKE '%@neesh.art';
$$;

REVOKE ALL ON FUNCTION public.due_profile_reminders() FROM anon, authenticated;;
