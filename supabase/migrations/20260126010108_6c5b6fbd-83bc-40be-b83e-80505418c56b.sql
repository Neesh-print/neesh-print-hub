-- Create shipping_addresses table
CREATE TABLE public.shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  
  -- Address fields
  label VARCHAR(100),
  recipient_name VARCHAR(200) NOT NULL,
  company_name VARCHAR(200),
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'United States',
  
  -- Contact for delivery issues
  phone VARCHAR(30),
  delivery_instructions TEXT,
  
  -- Flags
  is_default BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by retailer
CREATE INDEX idx_shipping_addresses_retailer ON public.shipping_addresses(retailer_id);

-- Ensure only one default address per retailer
CREATE UNIQUE INDEX idx_one_default_per_retailer 
  ON public.shipping_addresses(retailer_id) 
  WHERE is_default = TRUE;

-- Enable RLS
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Retailers can view own addresses"
  ON public.shipping_addresses
  FOR SELECT
  USING (retailer_id IN (
    SELECT id FROM public.retailers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Retailers can insert own addresses"
  ON public.shipping_addresses
  FOR INSERT
  WITH CHECK (retailer_id IN (
    SELECT id FROM public.retailers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Retailers can update own addresses"
  ON public.shipping_addresses
  FOR UPDATE
  USING (retailer_id IN (
    SELECT id FROM public.retailers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Retailers can delete own addresses"
  ON public.shipping_addresses
  FOR DELETE
  USING (retailer_id IN (
    SELECT id FROM public.retailers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all addresses"
  ON public.shipping_addresses
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add has_shipping_address column to retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS has_shipping_address BOOLEAN DEFAULT FALSE;

-- Trigger function to update retailer flag when address added/removed
CREATE OR REPLACE FUNCTION public.update_retailer_shipping_flag()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE retailers 
    SET has_shipping_address = TRUE 
    WHERE id = NEW.retailer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE retailers 
    SET has_shipping_address = EXISTS(
      SELECT 1 FROM shipping_addresses WHERE retailer_id = OLD.retailer_id
    )
    WHERE id = OLD.retailer_id;
    RETURN OLD;
  END IF;
END;
$$;

-- Create trigger
CREATE TRIGGER shipping_address_change
  AFTER INSERT OR UPDATE OR DELETE ON public.shipping_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_retailer_shipping_flag();

-- Trigger to update updated_at
CREATE TRIGGER update_shipping_addresses_updated_at
  BEFORE UPDATE ON public.shipping_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();