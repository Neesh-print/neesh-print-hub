-- Create publisher record for test publisher
INSERT INTO public.publishers (user_id, company_name, verified, verified_at, description)
VALUES (
  '8735729a-5caf-4e9d-a123-bdfb3ec3bbb9',
  'Indie Press Co',
  true,
  now(),
  'An independent publisher of beautiful magazines'
)
ON CONFLICT (user_id) DO NOTHING;

-- Create retailer record for test retailer
INSERT INTO public.retailers (user_id, shop_name, verified, verified_at, shop_description, city, country)
VALUES (
  '7bf7216e-ca90-44cc-9fc8-3b5ab9ba2779',
  'The Corner Bookshop',
  true,
  now(),
  'A cozy independent bookshop specializing in indie magazines',
  'Brooklyn',
  'USA'
)
ON CONFLICT (user_id) DO NOTHING;

-- Update profiles with business names
UPDATE public.profiles SET business_name = 'Indie Press Co', full_name = 'Test Publisher' WHERE user_id = '8735729a-5caf-4e9d-a123-bdfb3ec3bbb9';
UPDATE public.profiles SET business_name = 'The Corner Bookshop', full_name = 'Test Retailer' WHERE user_id = '7bf7216e-ca90-44cc-9fc8-3b5ab9ba2779';
UPDATE public.profiles SET full_name = 'Test Admin' WHERE user_id = '03fd014b-451a-4678-98b7-32a93069ba4b';