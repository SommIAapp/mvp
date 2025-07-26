/*
  # Restaurant Mode Tables

  1. New Tables
    - `restaurant_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `restaurant_name` (text)
      - `extracted_wines` (jsonb)
      - `session_active` (boolean)
      - `location_data` (jsonb)
      - `created_at` (timestamp)
      - `expires_at` (timestamp)
    
    - `restaurant_recommendations`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to restaurant_sessions)
      - `user_id` (uuid, foreign key to users)
      - `dish_description` (text)
      - `recommended_wines` (jsonb)
      - `alternative_wines` (jsonb)
      - `ai_reasoning` (text)
      - `match_quality` (numeric)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Performance indexes for user queries and session management
*/

-- Sessions restaurant (scan cartes)
CREATE TABLE IF NOT EXISTS restaurant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_name text,
  extracted_wines jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score numeric(3,2) DEFAULT 0.5,
  session_active boolean DEFAULT true,
  location_data jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '3 hours')
);

-- Recommandations restaurant (résultats avec contexte)
CREATE TABLE IF NOT EXISTS restaurant_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES restaurant_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_description text NOT NULL,
  recommended_wines jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternative_wines jsonb DEFAULT '[]'::jsonb,
  ai_reasoning text,
  match_quality numeric(3,2) DEFAULT 0.5,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE restaurant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_sessions
CREATE POLICY "Users can create own restaurant sessions"
  ON restaurant_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own restaurant sessions"
  ON restaurant_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own restaurant sessions"
  ON restaurant_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for restaurant_recommendations
CREATE POLICY "Users can create own restaurant recommendations"
  ON restaurant_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own restaurant recommendations"
  ON restaurant_recommendations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_user_active 
  ON restaurant_sessions(user_id, session_active);

CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_expires 
  ON restaurant_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_restaurant_recommendations_session 
  ON restaurant_recommendations(session_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_recommendations_user 
  ON restaurant_recommendations(user_id, created_at DESC);