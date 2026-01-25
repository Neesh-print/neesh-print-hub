-- Category Taxonomy Update
-- Updates existing magazine categories to reflect new taxonomy

-- Step 1: Rename "Literature" to "Literary"
UPDATE public.magazines
SET category = 'Literary'
WHERE category = 'Literature';

-- Step 2: Remove deprecated broad categories by setting to NULL
-- (Publications with these categories will need manual re-categorization)
-- Removing: Culture, Lifestyle (too broad/vague)
UPDATE public.magazines
SET category = NULL
WHERE category IN ('Culture', 'Lifestyle');

-- Step 3: Simplify "Food & Drink" to "Food" (if any exist)
UPDATE public.magazines
SET category = 'Food'
WHERE category = 'Food & Drink';

-- Note: The following categories are kept as-is:
-- Craft, Fashion, Gaming, Music, Nature, Photography, Sports, Technology, Travel
-- These are specific enough to be useful for retailers

-- Note: Design publications will need manual review to assign to:
-- Graphic Design, Interior Design, Product Design, or Typography