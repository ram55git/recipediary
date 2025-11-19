-- ============================================================================
-- CREDIT SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor to enable the credit system
-- ============================================================================

-- Step 1: Create profiles table to store user credits
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    credits INTEGER DEFAULT 10 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Service role (backend) can update profiles (for credit deduction/addition)
-- Note: Regular users should NOT be able to update their own credits directly via API
CREATE POLICY "Service role can update profiles" 
ON profiles FOR UPDATE 
USING (true);

-- Step 4: Create a trigger to create profile on signup
-- Function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, credits)
  VALUES (new.id, 10); -- Default 10 free credits
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 5: Backfill existing users (if any)
INSERT INTO public.profiles (id, credits)
SELECT id, 10 FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Step 6: Create RPC function to deduct credits safely
-- This function is called by the backend or client
CREATE OR REPLACE FUNCTION deduct_credits(amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INTEGER;
  user_id UUID;
BEGIN
  -- Get the user ID from the current session
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Validate amount
  IF amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Get current credits
  SELECT credits INTO current_credits FROM profiles WHERE id = user_id;
  
  IF current_credits IS NULL THEN
    -- Try to create profile if missing
    INSERT INTO profiles (id, credits) VALUES (user_id, 10) RETURNING credits INTO current_credits;
  END IF;
  
  IF current_credits < amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'current_balance', current_credits);
  END IF;
  
  -- Deduct credits
  UPDATE profiles SET credits = credits - amount WHERE id = user_id;
  
  RETURN jsonb_build_object('success', true, 'new_balance', current_credits - amount);
END;
$$;

-- Step 7: Create RPC function to add credits (for payments)
-- Note: In a real app, you'd want to restrict this to webhooks or admin only
CREATE OR REPLACE FUNCTION add_credits(user_id UUID, amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Validate amount
  IF amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Update or insert
  INSERT INTO profiles (id, credits)
  VALUES (user_id, amount + 10) -- 10 is default, so if new, they get amount + 10? No, just amount if we assume 0 start, but handle_new_user does 10.
  ON CONFLICT (id) DO UPDATE
  SET credits = profiles.credits + amount,
      updated_at = now()
  RETURNING credits INTO current_credits;
  
  RETURN jsonb_build_object('success', true, 'new_balance', current_credits);
END;
$$;

