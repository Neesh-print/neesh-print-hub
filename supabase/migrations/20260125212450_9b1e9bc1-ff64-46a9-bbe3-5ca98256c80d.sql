-- Add origin country code to magazines table
ALTER TABLE magazines ADD COLUMN origin_country_code VARCHAR(2) DEFAULT NULL;

-- Create index for filtering performance
CREATE INDEX idx_magazines_origin_country ON magazines(origin_country_code);

-- Create countries reference table
CREATE TABLE countries (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INT DEFAULT 999
);

-- Enable RLS on countries table
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- Allow public read access to countries
CREATE POLICY "Anyone can view countries"
ON countries FOR SELECT
USING (true);

-- Seed with common countries
INSERT INTO countries (code, name, display_order) VALUES
  ('US', 'United States', 1),
  ('GB', 'United Kingdom', 2),
  ('JP', 'Japan', 3),
  ('DE', 'Germany', 4),
  ('FR', 'France', 5),
  ('IT', 'Italy', 6),
  ('ES', 'Spain', 7),
  ('KR', 'South Korea', 8),
  ('NL', 'Netherlands', 9),
  ('AU', 'Australia', 10),
  ('CA', 'Canada', 11),
  ('SE', 'Sweden', 12),
  ('CH', 'Switzerland', 13),
  ('BE', 'Belgium', 14),
  ('AT', 'Austria', 15),
  ('DK', 'Denmark', 16),
  ('NO', 'Norway', 17),
  ('FI', 'Finland', 18),
  ('PT', 'Portugal', 19),
  ('IE', 'Ireland', 20),
  ('NZ', 'New Zealand', 21),
  ('MX', 'Mexico', 22),
  ('BR', 'Brazil', 23),
  ('AR', 'Argentina', 24),
  ('CL', 'Chile', 25),
  ('PL', 'Poland', 26),
  ('CZ', 'Czech Republic', 27),
  ('HU', 'Hungary', 28),
  ('GR', 'Greece', 29),
  ('TR', 'Turkey', 30),
  ('RU', 'Russia', 31),
  ('CN', 'China', 32),
  ('TW', 'Taiwan', 33),
  ('HK', 'Hong Kong', 34),
  ('SG', 'Singapore', 35),
  ('IN', 'India', 36),
  ('TH', 'Thailand', 37),
  ('ID', 'Indonesia', 38),
  ('MY', 'Malaysia', 39),
  ('PH', 'Philippines', 40),
  ('ZA', 'South Africa', 41),
  ('EG', 'Egypt', 42),
  ('IL', 'Israel', 43),
  ('AE', 'United Arab Emirates', 44),
  ('SA', 'Saudi Arabia', 45);