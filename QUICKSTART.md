# Quick Start Guide - Recipe Diary with Supabase

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (1 min)

```powershell
pip install -r requirements.txt
```

This installs:
- Flask (web server)
- Google Cloud Speech-to-Text
- Google Gemini AI
- Supabase (database)
- Other dependencies

### Step 2: Set Up Supabase (2 mins)

1. **Go to** https://supabase.com/ and sign up
2. **Create New Project**
   - Name: Recipe Diary
   - Password: (create one)
   - Region: (choose nearest)
3. **Create Table** - Go to SQL Editor, paste this:

```sql
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

CREATE INDEX idx_recipes_recipe_name ON recipes (recipe_name);
CREATE INDEX idx_recipes_created_at ON recipes (created_at DESC);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON recipes
FOR ALL
USING (true)
WITH CHECK (true);
```

4. Click **RUN**

### Step 3: Get API Keys (1 min)

#### Supabase:
- Settings > API
- Copy **Project URL** and **anon public key**

#### Google Gemini:
- Go to https://makersuite.google.com/app/apikey
- Create/copy API key

#### Google Speech-to-Text:
- Already have service account JSON? Use that path
- Don't have it? See README.md for full setup

### Step 4: Configure .env (1 min)

Create `.env` file:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\service-account.json
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
```

### Step 5: Run the App

```powershell
python app.py
```

Look for:
```
✓ Supabase client initialized
 * Running on http://localhost:5000
```

### Step 6: Use the App

Open http://localhost:5000

1. **Record a recipe:**
   - Select language
   - Click Start
   - Speak your recipe
   - Click Stop
   - Click "Transcribe & Generate Recipe"

2. **View gallery:**
   - Click "📚 My Recipes"
   - See all recipes
   - Click any card to view

3. **Edit a recipe:**
   - Open any recipe
   - Click "Edit"
   - Change any field
   - Click "Save Changes"

## ✨ Features

- ✅ Multi-language recording (25+ languages)
- ✅ Automatic transcription
- ✅ AI-powered recipe extraction
- ✅ Cloud database storage
- ✅ Search recipes
- ✅ Edit any recipe
- ✅ Delete recipes
- ✅ Export as images
- ✅ Mobile-friendly

## 🆘 Quick Troubleshooting

### App won't start?
```powershell
pip install -r requirements.txt
```

### "Supabase not initialized"?
- Check `.env` has SUPABASE_URL and SUPABASE_KEY
- Verify credentials are correct
- Restart the server

### Recipes not saving?
- Check Supabase table was created
- Look at Flask console for errors
- Verify internet connection

### Gallery empty?
- Record at least one recipe first
- Check Supabase Table Editor
- Refresh the page

## 📚 Full Documentation

- `README.md` - Complete setup guide
- `SUPABASE_SETUP.md` - Detailed database setup
- `IMPLEMENTATION_SUMMARY.md` - Feature overview

## 🎯 Test Recipe

Try recording this:

> "I'm making chocolate chip cookies. You'll need 2 cups of flour, 1 cup of sugar, half a cup of butter, 2 eggs, 1 teaspoon vanilla extract, and 1 cup of chocolate chips. First, preheat your oven to 350 degrees. Mix the butter and sugar until creamy. Add the eggs and vanilla. In a separate bowl, combine the flour and baking soda. Mix the dry ingredients into the wet ingredients. Fold in the chocolate chips. Drop spoonfuls onto a baking sheet. Bake for 10 to 12 minutes. This makes about 24 cookies. Prep time is 15 minutes, cook time is 12 minutes."

---

**Ready to start? Run `python app.py` and open http://localhost:5000!** 🍳
