-- Readers who click Order on Neesh land on the space-or-reader fork; the
-- reader branch records this signal for future analytics.
alter type public.signal_type add value if not exists 'reader_order';;
