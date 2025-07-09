/*
  # Fix user_profiles table schema

  1. Schema Updates
    - Add `full_name` column (text, nullable)
    - Add `trial_start_date` column (timestamp with time zone, nullable)  
    - Add `last_daily_reset` column (timestamp with time zone, nullable)
    - Update `subscription_plan` enum to include 'trial' value

  2. Data Migration
    - Set default values for existing records where appropriate

  3. Security
    - Maintain existing RLS policies
*/

-- First, update the subscription_plan enum to include 'trial'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'trial' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_plan')
  ) THEN
    ALTER TYPE subscription_plan ADD VALUE 'trial';
  END IF;
END $$;

-- Add missing columns to user_profiles table
DO $$
BEGIN
  -- Add full_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN full_name text;
  END IF;

  -- Add trial_start_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'trial_start_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN trial_start_date timestamptz;
  END IF;

  -- Add last_daily_reset column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_daily_reset'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_daily_reset timestamptz;
  END IF;
END $$;

-- Update existing records to have trial_start_date and last_daily_reset set to created_at
UPDATE user_profiles 
SET 
  trial_start_date = COALESCE(trial_start_date, created_at, now()),
  last_daily_reset = COALESCE(last_daily_reset, created_at, now())
WHERE trial_start_date IS NULL OR last_daily_reset IS NULL;