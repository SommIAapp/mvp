/*
  # Add trial_end_date column to user_profiles

  1. Schema Changes
    - Add `trial_end_date` column to `user_profiles` table
    - This will store the exact end date/time of the trial period

  2. Notes
    - Uses TIMESTAMPTZ for timezone awareness
    - Allows null values for users who haven't started trial yet
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'trial_end_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN trial_end_date TIMESTAMPTZ;
  END IF;
END $$;