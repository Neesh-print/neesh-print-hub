-- Drop publishers.total_magazines.
--
-- This column was never maintained (no trigger, default, or write path ever set
-- it), so it read 0 for every publisher and made any UI that trusted it wrong.
-- The magazine count is now derived live from the magazines table wherever it is
-- displayed (admin publisher list/detail, publisher profile).
ALTER TABLE public.publishers DROP COLUMN IF EXISTS total_magazines;
