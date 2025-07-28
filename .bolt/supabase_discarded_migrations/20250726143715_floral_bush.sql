```sql
-- Create restaurant_sessions table
CREATE TABLE public.restaurant_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_name text,
  extracted_wines jsonb NOT NULL,
  session_active boolean DEFAULT true,
  location_data jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '3 hours')
);

-- Enable Row Level Security for restaurant_sessions
ALTER TABLE public.restaurant_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for restaurant_sessions
CREATE POLICY "Users can create their own restaurant sessions"
ON public.restaurant_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own restaurant sessions"
ON public.restaurant_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own restaurant sessions"
ON public.restaurant_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own restaurant sessions"
ON public.restaurant_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for restaurant_sessions
CREATE INDEX idx_restaurant_sessions_user_id ON public.restaurant_sessions (user_id);
CREATE INDEX idx_restaurant_sessions_active ON public.restaurant_sessions (session_active) WHERE session_active = true;
CREATE INDEX idx_restaurant_sessions_expires ON public.restaurant_sessions (expires_at);


-- Create restaurant_recommendations table
CREATE TABLE public.restaurant_recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES public.restaurant_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_description text NOT NULL,
  recommended_wines jsonb NOT NULL, -- Wines from the restaurant's menu
  alternative_wines jsonb, -- General suggestions if no good match from menu
  ai_reasoning text,
  match_quality numeric(3,2), -- Overall quality score of the recommendations
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security for restaurant_recommendations
ALTER TABLE public.restaurant_recommendations ENABLE ROW LEVEL SECURITY;

-- Policies for restaurant_recommendations
CREATE POLICY "Users can create their own restaurant recommendations"
ON public.restaurant_recommendations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own restaurant recommendations"
ON public.restaurant_recommendations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own restaurant recommendations"
ON public.restaurant_recommendations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own restaurant recommendations"
ON public.restaurant_recommendations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for restaurant_recommendations
CREATE INDEX idx_restaurant_recommendations_session_id ON public.restaurant_recommendations (session_id);
CREATE INDEX idx_restaurant_recommendations_user_id ON public.restaurant_recommendations (user_id);
```