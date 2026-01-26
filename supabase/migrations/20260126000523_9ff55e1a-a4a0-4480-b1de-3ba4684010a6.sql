-- Temporarily deactivate magazines with broken Shopify CDN images
-- These use the old store URL pattern that no longer works
UPDATE magazines 
SET is_active = false, updated_at = now()
WHERE cover_image_url LIKE '%cdn.shopify.com/s/files/1/0915/4109/9559%';

-- This should affect: Calling All Horse Girls (Vol 2 & 5), Lost in the City, 
-- Mildew Issue 3, Offscreen Issue 24, Record Culture Issue 10, Slowe Issue 3, Sun & Moon