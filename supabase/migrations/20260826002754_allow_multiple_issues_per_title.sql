alter table public.magazines drop constraint unique_title_per_publisher;
alter table public.magazines add constraint unique_title_issue_per_publisher unique nulls not distinct (title, issue_number, publisher_id);;
