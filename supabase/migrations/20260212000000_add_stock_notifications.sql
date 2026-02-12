-- Stock notification requests for out-of-stock magazines
CREATE TABLE IF NOT EXISTS stock_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  magazine_id UUID NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  UNIQUE(retailer_id, magazine_id)
);

-- RLS policies
ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;

-- Retailers can manage their own notification requests
CREATE POLICY "Retailers can view own stock notifications"
  ON stock_notifications FOR SELECT
  USING (retailer_id IN (SELECT id FROM retailers WHERE user_id = auth.uid()));

CREATE POLICY "Retailers can create stock notifications"
  ON stock_notifications FOR INSERT
  WITH CHECK (retailer_id IN (SELECT id FROM retailers WHERE user_id = auth.uid()));

CREATE POLICY "Retailers can delete own stock notifications"
  ON stock_notifications FOR DELETE
  USING (retailer_id IN (SELECT id FROM retailers WHERE user_id = auth.uid()));

-- Publishers can view notifications for their magazines
CREATE POLICY "Publishers can view stock notifications for their magazines"
  ON stock_notifications FOR SELECT
  USING (magazine_id IN (SELECT id FROM magazines WHERE publisher_id IN (SELECT id FROM publishers WHERE user_id = auth.uid())));

-- Index for efficient lookups
CREATE INDEX idx_stock_notifications_retailer ON stock_notifications(retailer_id);
CREATE INDEX idx_stock_notifications_magazine ON stock_notifications(magazine_id);
