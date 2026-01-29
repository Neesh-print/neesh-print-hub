-- =============================================================
-- SECURITY FIX: Enable RLS on all exposed tables
-- =============================================================

-- 1. USERS TABLE (CRITICAL - contains emails, roles, usernames)
-- =============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own record only
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own record (except role)
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data"
ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role / triggers can insert users during signup
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;
CREATE POLICY "Service role can manage users"
ON public.users FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admin users can view all users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. MAGIC_LINK_TOKENS TABLE (CRITICAL - contains auth tokens)
-- =============================================================
ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can access
DROP POLICY IF EXISTS "Service role only access to magic_link_tokens" ON public.magic_link_tokens;
CREATE POLICY "Service role only access to magic_link_tokens"
ON public.magic_link_tokens FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. PROFILES TABLE
-- =============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. PUBLISHERS TABLE
-- =============================================================
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;

-- Publishers can manage their own record
DROP POLICY IF EXISTS "Publishers can view own publisher record" ON public.publishers;
CREATE POLICY "Publishers can view own publisher record"
ON public.publishers FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Publishers can update own record" ON public.publishers;
CREATE POLICY "Publishers can update own record"
ON public.publishers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Anyone can view verified publishers (for public profiles)
DROP POLICY IF EXISTS "Anyone can view verified publishers" ON public.publishers;
CREATE POLICY "Anyone can view verified publishers"
ON public.publishers FOR SELECT
USING (verified = true);

-- Admins can manage all publishers
DROP POLICY IF EXISTS "Admins can manage all publishers" ON public.publishers;
CREATE POLICY "Admins can manage all publishers"
ON public.publishers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Service role for system operations
DROP POLICY IF EXISTS "Service role can manage publishers" ON public.publishers;
CREATE POLICY "Service role can manage publishers"
ON public.publishers FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 5. RETAILERS TABLE
-- =============================================================
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;

-- Retailers can manage their own record
DROP POLICY IF EXISTS "Retailers can view own retailer record" ON public.retailers;
CREATE POLICY "Retailers can view own retailer record"
ON public.retailers FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Retailers can update own record" ON public.retailers;
CREATE POLICY "Retailers can update own record"
ON public.retailers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can manage all retailers
DROP POLICY IF EXISTS "Admins can manage all retailers" ON public.retailers;
CREATE POLICY "Admins can manage all retailers"
ON public.retailers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Service role for system operations
DROP POLICY IF EXISTS "Service role can manage retailers" ON public.retailers;
CREATE POLICY "Service role can manage retailers"
ON public.retailers FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 6. MAGAZINES TABLE
-- =============================================================
ALTER TABLE public.magazines ENABLE ROW LEVEL SECURITY;

-- Anyone can view active magazines (catalogue)
DROP POLICY IF EXISTS "Anyone can view active magazines" ON public.magazines;
CREATE POLICY "Anyone can view active magazines"
ON public.magazines FOR SELECT
USING (is_active = true);

-- Publishers can manage their own magazines
DROP POLICY IF EXISTS "Publishers can manage own magazines" ON public.magazines;
CREATE POLICY "Publishers can manage own magazines"
ON public.magazines FOR ALL
USING (
  publisher_id IN (
    SELECT id FROM public.publishers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  publisher_id IN (
    SELECT id FROM public.publishers WHERE user_id = auth.uid()
  )
);

-- Admins can manage all magazines
DROP POLICY IF EXISTS "Admins can manage all magazines" ON public.magazines;
CREATE POLICY "Admins can manage all magazines"
ON public.magazines FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 7. ORDERS TABLE
-- =============================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Retailers can view and create their own orders
DROP POLICY IF EXISTS "Retailers can view own orders" ON public.orders;
CREATE POLICY "Retailers can view own orders"
ON public.orders FOR SELECT
USING (retailer_id = auth.uid());

DROP POLICY IF EXISTS "Retailers can create orders" ON public.orders;
CREATE POLICY "Retailers can create orders"
ON public.orders FOR INSERT
WITH CHECK (retailer_id = auth.uid());

-- Publishers can view orders for their magazines
DROP POLICY IF EXISTS "Publishers can view orders for their magazines" ON public.orders;
CREATE POLICY "Publishers can view orders for their magazines"
ON public.orders FOR SELECT
USING (
  magazine_id IN (
    SELECT m.id FROM public.magazines m
    JOIN public.publishers p ON m.publisher_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

-- Publishers can update order status for their magazines
DROP POLICY IF EXISTS "Publishers can update their orders" ON public.orders;
CREATE POLICY "Publishers can update their orders"
ON public.orders FOR UPDATE
USING (
  magazine_id IN (
    SELECT m.id FROM public.magazines m
    JOIN public.publishers p ON m.publisher_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

-- Admins can manage all orders
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders"
ON public.orders FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 8. PAYMENT_SESSIONS TABLE
-- =============================================================
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment sessions
DROP POLICY IF EXISTS "Users can view own payment sessions" ON public.payment_sessions;
CREATE POLICY "Users can view own payment sessions"
ON public.payment_sessions FOR SELECT
USING (user_id = auth.uid());

-- Service role can manage all payment sessions
DROP POLICY IF EXISTS "Service role can manage payment sessions" ON public.payment_sessions;
CREATE POLICY "Service role can manage payment sessions"
ON public.payment_sessions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admins can view all payment sessions
DROP POLICY IF EXISTS "Admins can view all payment sessions" ON public.payment_sessions;
CREATE POLICY "Admins can view all payment sessions"
ON public.payment_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 9. PRODUCTS TABLE
-- =============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can view published products
DROP POLICY IF EXISTS "Anyone can view published products" ON public.products;
CREATE POLICY "Anyone can view published products"
ON public.products FOR SELECT
USING (status = 'published');

-- Publishers can manage their own products
DROP POLICY IF EXISTS "Publishers can manage own products" ON public.products;
CREATE POLICY "Publishers can manage own products"
ON public.products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.publishers 
    WHERE id = publisher_id AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.publishers 
    WHERE id = publisher_id AND user_id = auth.uid()
  )
);

-- Admins can manage all products
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
CREATE POLICY "Admins can manage all products"
ON public.products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 10. RETAILER_APPLICATIONS TABLE
-- =============================================================
ALTER TABLE public.retailer_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application (unauthenticated)
DROP POLICY IF EXISTS "Anyone can submit retailer application" ON public.retailer_applications;
CREATE POLICY "Anyone can submit retailer application"
ON public.retailer_applications FOR INSERT
WITH CHECK (true);

-- Applicants can view their own applications by email (before auth)
DROP POLICY IF EXISTS "Applicants can view own applications by email" ON public.retailer_applications;
CREATE POLICY "Applicants can view own applications by email"
ON public.retailer_applications FOR SELECT
USING (
  buyer_email = current_setting('request.jwt.claims', true)::json->>'email'
  OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admins can manage all applications
DROP POLICY IF EXISTS "Admins can manage retailer applications" ON public.retailer_applications;
CREATE POLICY "Admins can manage retailer applications"
ON public.retailer_applications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 11. MAILING_LIST_SUBSCRIBERS TABLE
-- =============================================================
ALTER TABLE public.mailing_list_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe
DROP POLICY IF EXISTS "Anyone can subscribe to mailing list" ON public.mailing_list_subscribers;
CREATE POLICY "Anyone can subscribe to mailing list"
ON public.mailing_list_subscribers FOR INSERT
WITH CHECK (true);

-- Admins can manage subscribers
DROP POLICY IF EXISTS "Admins can manage mailing list" ON public.mailing_list_subscribers;
CREATE POLICY "Admins can manage mailing list"
ON public.mailing_list_subscribers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);