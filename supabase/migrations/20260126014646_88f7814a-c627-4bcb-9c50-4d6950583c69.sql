-- Add sample social links to the test publisher
UPDATE publishers 
SET 
  instagram_handle = 'neeshmagazines', 
  website_url = 'https://neesh.art'
WHERE id = '00000000-0000-0000-0000-000000000001';