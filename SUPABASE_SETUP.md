# Supabase Setup Guide for Recipe Diary

## Quick Setup Steps

### 1. Create Supabase Account & Project

1. Go to https://supabase.com/
2. Click "Start your project" and sign up (or sign in)
3. Click "New Project"
4. Fill in:
   - **Name**: Recipe Diary
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your location
5. Click "Create new project" (takes ~2 minutes)

### 2. Create the Recipes Table

Once your project is ready:

1. Click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy and paste this SQL:

```sql
-- Create the recipes table
CREATE TABLE recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_name TEXT NOT NULL,
    author TEXT,
    description TEXT,
    prep_time TEXT,
    cook_time TEXT,
    yield TEXT,
    ingredients JSONB DEFAULT '[]'::jsonb,
    instructions JSONB DEFAULT '[]'::jsonb,
    tips JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create indexes for faster searches
CREATE INDEX idx_recipes_recipe_name ON recipes (recipe_name);
CREATE INDEX idx_recipes_created_at ON recipes (created_at DESC);

-- Enable Row Level Security
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for single-user app)
CREATE POLICY "Allow all operations" ON recipes
FOR ALL
USING (true)
WITH CHECK (true);
```

4. Click **RUN** (bottom right)
5. You should see "Success. No rows returned"

### 3. Verify Table Creation

1. Click **Table Editor** in the left sidebar
2. You should see the `recipes` table listed
3. Click on it to see the columns

### 4. Get Your API Credentials

1. Click **Settings** (gear icon) in the left sidebar
2. Click **API** in the settings menu
3. Copy these two values:

   **Project URL:**
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```
   
   **API Key (anon public):**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
   ```

### 5. Add to Your .env File

Open your `.env` file and add:

```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with your actual values from step 4.

### 6. Install Python Dependencies

```powershell
pip install supabase
```

Or reinstall all dependencies:
```powershell
pip install -r requirements.txt
```

### 7. Test the Connection

1. Start your Flask app:
   ```powershell
   python app.py
   ```

2. You should see in the console:
   ```
   ✓ Supabase client initialized
   ```

3. Open your browser to http://localhost:5000
4. Record or upload a recipe
5. After generation, check your Supabase dashboard:
   - Go to **Table Editor** > **recipes**
   - You should see your first recipe!

## Troubleshooting

### "Supabase client not initialized" Warning

**Problem:** You see this warning when starting the app
```
⚠ Warning: Supabase credentials not found. Database features will be disabled.
```

**Solutions:**
1. Check that `SUPABASE_URL` and `SUPABASE_KEY` are in your `.env` file
2. Verify there are no typos in the variable names
3. Make sure `.env` is in the same directory as `app.py`
4. Restart the Flask server after adding credentials

### "Failed to save to database" Error

**Problem:** Recipe generates but doesn't save to database

**Solutions:**
1. Check that the recipes table exists in Supabase
2. Verify your API key is correct (copy it again from Supabase dashboard)
3. Check if Row Level Security policy is set up (see SQL above)
4. Look at the Flask console for specific error messages
5. Check your internet connection

### "Failed to load recipes" in Gallery

**Problem:** Gallery view shows error or empty state

**Solutions:**
1. Verify Supabase credentials in `.env`
2. Check that recipes table exists and has the correct schema
3. Look at browser console (F12) for error details
4. Try accessing the API directly: http://localhost:5000/api/health

### Cannot Edit or Delete Recipes

**Problem:** Edit or Delete buttons don't work

**Solutions:**
1. Ensure Row Level Security policy allows updates and deletes
2. Check browser console for error messages
3. Verify the recipe has a valid `id` field
4. Try refreshing the page

## Database Management

### View All Recipes
1. Go to Supabase Dashboard
2. Click **Table Editor** > **recipes**
3. See all your recipes in table format

### Manually Edit a Recipe
1. In Table Editor, click on any cell to edit
2. Click the checkmark to save changes

### Delete a Recipe
1. In Table Editor, hover over the row number
2. Click the trash icon

### Backup Your Recipes
1. Go to **Table Editor** > **recipes**
2. Click **⋮** (three dots) > **Download as CSV**
3. Save the file to back up all your recipes

### Reset/Clear All Recipes
```sql
-- WARNING: This deletes ALL recipes
TRUNCATE TABLE recipes;
```

## Security Best Practices

### For Production Use:

If you want to add user authentication later:

1. **Set up Supabase Auth**
2. **Update RLS Policy** to restrict access:

```sql
-- Remove the "allow all" policy
DROP POLICY "Allow all operations" ON recipes;

-- Add user-specific policies
CREATE POLICY "Users can view their own recipes" ON recipes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipes" ON recipes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add user_id column
ALTER TABLE recipes ADD COLUMN user_id UUID REFERENCES auth.users(id);
```

## Monitoring & Limits

### Free Tier Limits:
- **Database Size**: 500 MB
- **Bandwidth**: 2 GB per month
- **API Requests**: Unlimited
- **File Storage**: 1 GB

### Check Your Usage:
1. Go to Supabase Dashboard
2. Click **Settings** > **Usage**
3. Monitor database size and bandwidth

### What Uses Space:
- Each recipe: ~2-5 KB
- **Estimate**: 500 MB can store ~100,000 recipes

## Next Steps

✅ Supabase is set up!

Now you can:
- Record recipes and they auto-save to the cloud
- View all recipes in the Gallery
- Search for recipes
- Edit recipes with live editing
- Delete recipes you don't want
- Access your recipes from any device (same Supabase account)

---

**Need Help?**
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com/
