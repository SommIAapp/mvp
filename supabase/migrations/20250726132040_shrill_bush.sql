/*
  # Restaurant Mode Tables

  1. New Tables
    - `restaurant_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `restaurant_name` (text, detected or manual)
      - `wine_list_image_url` (text, photo URL)
      - `extracted_wines` (jsonb, OCR results)
      - `session_active` (boolean, session status)
      - `location_data` (jsonb, GPS if available)
      - `created_at` (timestamp)

    - `scanned_restaurant_wines`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to restaurant_sessions)
      - `wine_name` (text, extracted wine name)
      - `wine_price_glass` (numeric, price per glass)
      - `wine_price_bottle` (numeric, price per bottle)
      - `wine_type` (text, wine color/type)
      - `wine_region` (text, wine region)
      - `extracted_from_ocr` (boolean, OCR vs manual)
      - `confidence_score` (numeric, OCR confidence)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to access their own data
*/

-- Restaurant sessions table
CREATE TABLE IF NOT EXISTS restaurant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_name text,
  wine_list_image_url text,
  extracted_wines jsonb DEFAULT '[]'::jsonb,
  session_active boolean DEFAULT true,
  location_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Scanned restaurant wines table
CREATE TABLE IF NOT EXISTS scanned_restaurant_wines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES restaurant_sessions(id) ON DELETE CASCADE,
  wine_name text NOT NULL,
  wine_price_glass numeric(8,2),
  wine_price_bottle numeric(8,2),
  wine_type text,
  wine_region text,
  extracted_from_ocr boolean DEFAULT true,
  confidence_score numeric(3,2),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE restaurant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_restaurant_wines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_sessions
CREATE POLICY "Users can read own restaurant sessions"
  ON restaurant_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own restaurant sessions"
  ON restaurant_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own restaurant sessions"
  ON restaurant_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for scanned_restaurant_wines
CREATE POLICY "Users can read wines from own sessions"
  ON scanned_restaurant_wines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurant_sessions 
      WHERE restaurant_sessions.id = scanned_restaurant_wines.session_id 
      AND restaurant_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create wines for own sessions"
  ON scanned_restaurant_wines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurant_sessions 
      WHERE restaurant_sessions.id = scanned_restaurant_wines.session_id 
      AND restaurant_sessions.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_user_id 
  ON restaurant_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_active 
  ON restaurant_sessions(session_active) 
  WHERE session_active = true;

CREATE INDEX IF NOT EXISTS idx_scanned_wines_session_id 
  ON scanned_restaurant_wines(session_id);

CREATE INDEX IF NOT EXISTS idx_scanned_wines_type 
  ON scanned_restaurant_wines(wine_type);

-- Add constraint for confidence score
ALTER TABLE scanned_restaurant_wines 
ADD CONSTRAINT confidence_score_range 
CHECK (confidence_score >= 0 AND confidence_score <= 1);