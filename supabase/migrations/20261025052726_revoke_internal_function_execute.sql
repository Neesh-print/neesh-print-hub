-- Internal functions were left with Postgres' default EXECUTE grant to
-- PUBLIC (and Supabase's default grant to anon and authenticated), so anyone
-- holding the publishable key could call them through PostgREST.
-- Revoke from everyone and grant back to service_role. Trigger functions
-- keep firing: Postgres checks EXECUTE on a trigger function when the
-- trigger is created, not when it fires.

revoke execute on function refresh_directory_cities() from public, anon, authenticated;
revoke execute on function directory_slugify(text) from public, anon, authenticated;
revoke execute on function directory_stores_set_slug() from public, anon, authenticated;
revoke execute on function directory_set_updated_at() from public, anon, authenticated;

grant execute on function refresh_directory_cities() to service_role;
grant execute on function directory_slugify(text) to service_role;
grant execute on function directory_stores_set_slug() to service_role;
grant execute on function directory_set_updated_at() to service_role;;
