/*
  # Add Row Level Security to user_profiles table

  1. Security Updates
    - Enable RLS on user_profiles table
    - Add policy for users to view their own profile
    - Add policy for users to update their own profile
    - Add policy for users to insert their own profile

  2. Important Notes
    - This addresses a critical security vulnerability
    - Users should only access their own profile data
    - Service role maintains full access for system operations
*/

-- Enable RLS on user_profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy for users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy for users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Policy for service role to manage all profiles (for system operations)
CREATE POLICY "Service role can manage all profiles"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);