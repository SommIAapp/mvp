/*
  # Update recommendations table schema

  1. Schema Changes
    - Replace `user_email` column with `user_id` (uuid, references auth.users)
    - Add `user_budget` column (numeric, nullable)
    - Update existing data to use user IDs instead of emails
    - Add foreign key constraint for data integrity

  2. Data Migration
    - Migrate existing recommendations from email-based to user ID-based
    - Preserve all existing recommendation data

  3. Security
    - Enable RLS on recommendations table
    - Add policy for users to view their own recommendations
*/

-- First, add the new columns
DO $$
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN user_id uuid;
  END IF;

  -- Add user_budget column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'user_budget'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN user_budget numeric(8,2);
  END IF;
END $$;

-- Migrate existing data from user_email to user_id
UPDATE recommendations 
SET user_id = auth.users.id
FROM auth.users 
WHERE recommendations.user_email = auth.users.email
AND recommendations.user_id IS NULL;

-- Drop the old user_email column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE recommendations DROP COLUMN user_email;
  END IF;
END $$;

-- Add foreign key constraint
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

-- Create policy for users to view their own recommendations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'recommendations' 
    AND policyname = 'Users can view their own recommendations'
  ) THEN
    CREATE POLICY "Users can view their own recommendations"
      ON recommendations
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Create policy for users to insert their own recommendations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'recommendations' 
    AND policyname = 'Users can insert their own recommendations'
  ) THEN
    CREATE POLICY "Users can insert their own recommendations"
      ON recommendations
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;