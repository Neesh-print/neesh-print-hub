-- Trigger functions are never called directly; keep them off the API.
revoke execute on function collection_items_log() from public, anon, authenticated;
revoke execute on function collector_titles_log() from public, anon, authenticated;
revoke execute on function availability_requests_log() from public, anon, authenticated;
revoke execute on function content_reports_flag() from public, anon, authenticated;
revoke execute on function reader_rejections_check() from public, anon, authenticated;
revoke execute on function orders_report_issue_availability() from public, anon, authenticated;
revoke execute on function directory_issue_availability_expiry() from public, anon, authenticated;
revoke execute on function collectors_guard_can_add() from public, anon, authenticated;

alter function collect_events_suppressed() set search_path = public;
alter function collectors_guard_can_add() set search_path = public;
alter function directory_issue_availability_expiry() set search_path = public;;
