-- ============================================================================
-- SUPABASE AUTHENTICATION MIGRATION
-- Run this in your Supabase SQL Editor to enable multi-user authentication
-- ============================================================================

-- Step 1: Add user_id column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;

-- Step 5: Create RLS Policies

-- Policy: Users can only view their own recipes
CREATE POLICY "Users can view own recipes" 
ON recipes FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can only insert recipes with their own user_id
CREATE POLICY "Users can insert own recipes" 
ON recipes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own recipes
CREATE POLICY "Users can update own recipes" 
ON recipes FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy: Users can only delete their own recipes
CREATE POLICY "Users can delete own recipes" 
ON recipes FOR DELETE 
USING (auth.uid() = user_id);

-- Step 6: (OPTIONAL) Migrate existing recipes to a default user
-- If you have existing recipes without user_id, you can either:
-- A) Assign them to a specific user (replace 'YOUR-USER-ID' with actual UUID)
-- UPDATE recipes SET user_id = 'YOUR-USER-ID' WHERE user_id IS NULL;

-- B) Delete existing recipes (use with caution!)
-- DELETE FROM recipes WHERE user_id IS NULL;

-- C) Create a "system" user and assign them there
-- (You'll need to create this user in Supabase Auth first)

-- Verification: Check the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'recipes';

-- Success! Your recipes table now supports multi-user authentication.
