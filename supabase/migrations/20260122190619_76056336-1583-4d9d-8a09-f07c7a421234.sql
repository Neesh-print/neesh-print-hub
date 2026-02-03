-- First, clear existing test data from magazines table
DELETE FROM magazines WHERE title IN ('Kinfolk', 'Cereal', 'Apartamento', 'The Gentlewoman', 'Drift', 'Eye on Design', 'Victory Journal', 'MacGuffin');

-- First ensure we have a default publisher for imports
INSERT INTO publishers (id, user_id, company_name, description, application_status)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  'Neesh Imports',
  'Imported publishers from Shopify catalogue',
  'approved'
WHERE NOT EXISTS (SELECT 1 FROM publishers WHERE id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Insert the Shopify products (including price column which is required)
INSERT INTO magazines (
  title, 
  description, 
  price,
  wholesale_price, 
  suggested_retail_price, 
  cover_image_url, 
  category, 
  issue_number, 
  issue_frequency,
  is_active, 
  inventory_count,
  publisher_id,
  specs
) VALUES
-- Wax Poetics Issue 75
(
  'Wax Poetics Issue 75',
  'This issue of Wax Poetics features Thundercat on its cover. Wax Poetics magazine is the definitive publication for the true record collector and music lover. Covering soul, funk, hip-hop, jazz, reggae, Latin, African, blues, and R&B.',
  14.00,
  14.00,
  28.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/71XKJI_w0cL._SL1500.jpg?v=1746481093',
  'Music',
  'Issue 75',
  'Bi-annual',
  true,
  1500,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '144 pages, 8.5" x 11", Matte cover, Perfect bound'
),
-- Pitch Magazine Issue 14
(
  'Pitch Magazine Issue 14',
  'Pitch is the best sports magazine in the world. They cover football, cricket, rugby, golf, MMA, boxing, athletics, F1, and more—with stunning photography, bold design, and a truly global perspective.',
  12.50,
  12.50,
  25.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/71s4DPbhjpL._SL1500.jpg?v=1746481093',
  'Sports',
  'Issue 14',
  'Bi-annual',
  true,
  500,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '180 pages, 9" x 12", Gloss cover, Perfect bound'
),
-- Mushroom People Magazine Volume 2
(
  'Mushroom People Magazine Volume 2',
  'Mushroom People Magazine is a beautifully designed indie publication celebrating the world of fungi, mycology, nature, and the people passionate about mushrooms.',
  12.00,
  12.00,
  24.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/81xQfS2XEPL._SL1500.jpg?v=1746481093',
  'Nature',
  'Volume 2',
  'Annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '128 pages, 8" x 10", Matte cover, Perfect bound'
),
-- The Drift
(
  'The Drift',
  'The Drift is a seminal critical publication of our era, exploring where culture, politics, and ideas collide. Perfect for intellectually curious readers who want challenging, provocative essays.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/81bxrePl5YL._SL1500.jpg?v=1746481093',
  'Culture',
  'Current Issue',
  'Bi-annual',
  true,
  500,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '200 pages, 6" x 9", Matte cover, Perfect bound'
),
-- photoED magazine Issue 75
(
  'photoED magazine Issue 75',
  'photoED is Canada''s leading photography magazine, showcasing fine art photography, emerging artists, and the movement of contemporary visual culture.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/photoED_Magazine_Issue75_Summer2025_Cover_1024x1024_f9f65a8a-1c9f-456b-a26b-70005d3844ac.webp?v=1746481093',
  'Photography',
  'Issue 75',
  'Quarterly',
  true,
  100,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '96 pages, 8.5" x 11", Gloss cover, Saddle-stitched'
),
-- Wyrd Science Issue 7
(
  'Wyrd Science Issue 7',
  'Wyrd Science is the premier magazine for tabletop gaming culture—covering RPGs, wargames, board games, and the creative community behind them.',
  12.50,
  12.50,
  25.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/WS7_1.webp?v=1746481093',
  'Gaming',
  'Issue 7',
  'Quarterly',
  true,
  300,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '148 pages, 8.5" x 11", Matte cover, Perfect bound'
),
-- Catnip Magazine Vol 2
(
  'Catnip Magazine Vol 2',
  'Catnip Magazine is a delightful indie publication celebrating cats, culture, art, design, and the humans who love them. Essays, photography, and humor for cat enthusiasts.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/819PHG36GPL._SL1500.jpg?v=1746481093',
  'Lifestyle',
  'Volume 2',
  'Annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '112 pages, 7" x 9", Matte cover, Perfect bound'
),
-- Calling All Horse Girls Vol 5 Sporty
(
  'Calling All Horse Girls Vol 5 Sporty',
  'Calling All Horse Girls celebrates modern horse girl culture—lifestyle, fashion, equestrian sports, and the community that embraces it all. This sporty edition focuses on competition and accessibility.',
  12.00,
  12.00,
  24.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/horsegirlsvol5sporty.png?v=1746481093',
  'Lifestyle',
  'Vol 5 Sporty',
  'Bi-annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '96 pages, 8" x 10.5", Matte cover, Perfect bound'
),
-- Sun & Moon A Celestial Magazine
(
  'Sun & Moon A Celestial Magazine',
  'Sun & Moon is a beautifully crafted magazine exploring the celestial world—nature, mythology, science, history, and the cultural significance of our cosmic neighbors.',
  12.00,
  12.00,
  24.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/sunandmoon.png?v=1746481093',
  'Nature',
  'Volume 1',
  'Annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '144 pages, 8.5" x 11", Gloss cover, Perfect bound'
),
-- Mildew Magazine Issue 3
(
  'Mildew Magazine Issue 3',
  'Mildew Magazine explores the world of secondhand fashion, sustainability, creative reuse, vintage finds, and global thrift culture through stunning photography and stories.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/mildew3.png?v=1746481093',
  'Fashion',
  'Issue 3',
  'Bi-annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '128 pages, 8" x 10", Matte cover, Perfect bound'
),
-- Mildew Magazine Issue 4
(
  'Mildew Magazine Issue 4',
  'Mildew Magazine explores the world of secondhand fashion, sustainability, creative reuse, vintage finds, and global thrift culture through stunning photography and stories.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/mildew4.png?v=1746481093',
  'Fashion',
  'Issue 4',
  'Bi-annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '128 pages, 8" x 10", Matte cover, Perfect bound'
),
-- Calling All Horse Girls Vol 2 Working
(
  'Calling All Horse Girls Vol 2 Working',
  'Calling All Horse Girls celebrates modern horse girl culture—lifestyle, fashion, nostalgia, subculture, and Americana. This working edition explores the daily lives of horse people.',
  12.00,
  12.00,
  24.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/horsegirlsvol2working.png?v=1746481093',
  'Lifestyle',
  'Vol 2 Working',
  'Bi-annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '96 pages, 8" x 10.5", Matte cover, Perfect bound'
),
-- We Are Makers Edition 16
(
  'We Are Makers Edition 16',
  'We Are Makers celebrates craft, DIY culture, artisans, and the handmade movement. Features traditional crafts, maker stories, and creative inspiration.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/wearemakers16.png?v=1746481093',
  'Craft',
  'Edition 16',
  'Quarterly',
  true,
  500,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '112 pages, 8" x 10", Matte cover, Perfect bound'
),
-- Somesuch Stories
(
  'Somesuch Stories',
  'Somesuch Stories is a literary and cultural magazine featuring fiction, poetry, art, photography, and essays from emerging and established voices.',
  12.00,
  12.00,
  24.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/somesuchstories.png?v=1746481093',
  'Literature',
  'Various',
  'Annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '160 pages, 6" x 9", Matte cover, Perfect bound'
),
-- Catnip Magazine Vol 1
(
  'Catnip Magazine Vol 1',
  'Catnip Magazine is a delightful indie publication celebrating cats, culture, art, design, and the humans who love them. Essays, photography, and humor for cat enthusiasts.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/catnip1.png?v=1746481093',
  'Lifestyle',
  'Volume 1',
  'Annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '112 pages, 7" x 9", Matte cover, Perfect bound'
),
-- Heartbeat Magazine
(
  'Heartbeat Magazine',
  'Heartbeat Magazine explores the intersection of music, sound, emotion, and culture—celebrating the art of listening and the stories behind the sounds we love.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/heartbeat1.png?v=1746481093',
  'Music',
  'Volume 1',
  'Annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '128 pages, 8" x 10", Matte cover, Perfect bound'
),
-- Record Culture Magazine Issue 10
(
  'Record Culture Magazine Issue 10',
  'Record Culture Magazine celebrates vinyl records, music collecting, and the culture surrounding physical music. Features collector stories, rare finds, and industry interviews.',
  12.00,
  12.00,
  24.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/recordculture10.png?v=1746481093',
  'Music',
  'Issue 10',
  'Quarterly',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '144 pages, 9" x 12", Gloss cover, Perfect bound'
),
-- Slowe Magazine Issue 3
(
  'Slowe Magazine Issue 3',
  'Slowe Magazine embraces slow living, mindfulness, and intentional lifestyle. Features on wellness, sustainability, and finding balance in modern life.',
  10.00,
  10.00,
  20.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/slowe3.png?v=1746481093',
  'Lifestyle',
  'Issue 3',
  'Bi-annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '120 pages, 7" x 9.5", Matte cover, Perfect bound'
),
-- Lost in the City Magazine
(
  'Lost in the City Magazine',
  'Lost in the City explores urban culture, street photography, city life, and the stories of people navigating metropolitan landscapes around the world.',
  12.00,
  12.00,
  24.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/lostinthecity.png?v=1746481093',
  'Travel',
  'Current Issue',
  'Bi-annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '144 pages, 8.5" x 11", Matte cover, Perfect bound'
),
-- Offscreen Magazine Issue 24
(
  'Offscreen Magazine Issue 24',
  'Offscreen Magazine explores the human side of technology and the web. Thoughtful interviews, essays, and stories about the people behind the screens.',
  12.50,
  12.50,
  25.00,
  'https://cdn.shopify.com/s/files/1/0915/4109/9559/files/offscreen24.png?v=1746481093',
  'Technology',
  'Issue 24',
  'Bi-annual',
  true,
  50,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '128 pages, 6.75" x 9.5", Softcover, Perfect bound'
)
ON CONFLICT DO NOTHING;