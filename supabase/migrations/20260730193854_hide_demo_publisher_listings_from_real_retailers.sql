-- Demo listings (Indie Press Co / publisher@test.com) stay visible only to demo accounts.
-- Real retailers and anonymous visitors no longer see them in the catalogue.
-- The demo publisher still sees its own listings via the "manage own magazines" policy,
-- and admins still see everything via is_admin().

alter policy "Anyone can view active magazines" on public.magazines
using (
  is_active = true
  and (
    publisher_id <> '8735729a-5caf-4e9d-a123-bdfb3ec3bbb9'  -- Indie Press Co (demo)
    or auth.uid() in (
      '7bf7216e-ca90-44cc-9fc8-3b5ab9ba2779',  -- retailer@test.com (Fog & Fern Books)
      '09dbffdf-5c9b-418d-b687-ee519b4944e9'   -- bakari@neesh.art (Berry Books & Goods)
    )
  )
);

alter policy "Anyone can view published magazines" on public.magazines
using (
  is_active = true
  and (
    publisher_id <> '8735729a-5caf-4e9d-a123-bdfb3ec3bbb9'
    or auth.uid() in (
      '7bf7216e-ca90-44cc-9fc8-3b5ab9ba2779',
      '09dbffdf-5c9b-418d-b687-ee519b4944e9'
    )
  )
);;
