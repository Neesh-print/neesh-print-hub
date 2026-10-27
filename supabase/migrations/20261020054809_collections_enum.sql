-- Your collection on Neesh (spec Oct 19, 2026), part 1 of 2.
-- A new enum value cannot be used in the transaction that adds it, and the
-- RLS policies and defaults in part 2 use 'reader_created', so it lands on
-- its own first.
alter type provenance add value if not exists 'reader_created';;
