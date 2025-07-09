/*
  # Add user_id column to recommendations table

  1. Changes
    - Add `user_id` column to `recommendations` table if it doesn't exist
    - Add foreign key constraint to reference `users` table
    - Update RLS policies to use the user_id column

  2. Security
    - Maintain existing RLS policies
    - Ensure users can only access their own recommendations
*/

-- Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'recommendations_user_id_fkey'
  ) THEN
    ALTER TABLE recommendations 
    ADD CONSTRAINT recommendations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their own recommendations" ON recommendations;
DROP POLICY IF EXISTS "Users can insert their own recommendations" ON recommendations;

-- Create RLS policies
CREATE POLICY "Users can view their own recommendations"
  ON recommendations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own recommendations"
  ON recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());