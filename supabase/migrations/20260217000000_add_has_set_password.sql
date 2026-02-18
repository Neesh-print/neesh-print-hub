-- Add has_set_password flag to profiles table
-- New users created via approve-application will have this set to false
-- forcing them to set a password on first dashboard visit
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_set_password BOOLEAN DEFAULT true;

-- Allow users to update their own has_set_password flag
CREATE POLICY "Users can update own has_set_password"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
