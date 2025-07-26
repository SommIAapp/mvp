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

-- Enable RLS for restaurant_sessions
ALTER TABLE public.restaurant_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for restaurant_sessions
CREATE POLICY "Users can create own restaurant sessions" ON public.restaurant_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own restaurant sessions" ON public.restaurant_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own restaurant sessions" ON public.restaurant_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own restaurant sessions" ON public.restaurant_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Create restaurant_recommendations table
CREATE TABLE public.restaurant_recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES public.restaurant_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_description text NOT NULL,
  recommended_wines jsonb NOT NULL,
  alternative_wines jsonb,
  ai_reasoning text,
  match_quality numeric(3,2),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for restaurant_recommendations
ALTER TABLE public.restaurant_recommendations ENABLE ROW LEVEL SECURITY;

-- Policies for restaurant_recommendations
CREATE POLICY "Users can create recommendations for own sessions" ON public.restaurant_recommendations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.restaurant_sessions WHERE id = session_id AND user_id = auth.uid()));

CREATE POLICY "Users can read recommendations for own sessions" ON public.restaurant_recommendations
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.restaurant_sessions WHERE id = session_id AND user_id = auth.uid()));

CREATE POLICY "Users can update recommendations for own sessions" ON public.restaurant_recommendations
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.restaurant_sessions WHERE id = session_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete recommendations for own sessions" ON public.restaurant_recommendations
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.restaurant_sessions WHERE id = session_id AND user_id = auth.uid()));

-- Indexes for restaurant_sessions
CREATE INDEX idx_restaurant_sessions_user_active ON public.restaurant_sessions(user_id, session_active);
CREATE INDEX idx_restaurant_sessions_expires ON public.restaurant_sessions(expires_at);

-- Indexes for restaurant_recommendations
CREATE INDEX idx_restaurant_recommendations_session_id ON public.restaurant_recommendations(session_id);
CREATE INDEX idx_restaurant_recommendations_user_id ON public.restaurant_recommendations(user_id);
```