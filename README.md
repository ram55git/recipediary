# Recipe Diary - Audio Recipe Recorder 🍳

A responsive web application that allows users to record or upload audio descriptions of recipes, which are then automatically transcribed and converted into structured recipe cards using Google Cloud Speech-to-Text and Gemini AI. All recipes are saved to a Supabase cloud database for easy access and management.

## Features

✨ **Audio Recording**
- Record audio directly in the browser (up to 5 minutes)
- Start, Pause, Resume, and Stop controls
- Real-time recording timer and progress bar
- Visual feedback for recording status
- **Multi-language support** (125+ languages including Hindi, Tamil, Spanish, etc.)

📁 **File Upload**
- Upload pre-recorded audio files
- Drag & drop support
- Supports multiple audio formats (MP3, WAV, OGG, M4A)

🎙️ **Speech-to-Text**
- Automatic transcription using Google Cloud Speech-to-Text API
- High accuracy with automatic punctuation
- **Multi-language transcription support**

🤖 **AI-Powered Recipe Extraction**
- Uses Google Gemini AI to extract structured recipe information
- Automatically identifies:
  - Recipe name and author
  - Description
  - Ingredients list with quantities
  - Step-by-step instructions
  - Prep time, cook time, and servings
  - Cooking tips and variations

� **Recipe Gallery**
- Cloud-based storage with Supabase database
- Browse all saved recipes in a beautiful gallery view
- **Search functionality** - find recipes by name, author, or description
- View detailed recipe information in modal
- **Edit mode** - modify any recipe field with live editing
- **Delete recipes** you no longer need
- Automatic save after each recording

💾 **Export Features**
- **Save as Image** - Download recipes as PNG for sharing
- Print-friendly recipe cards

�📱 **Responsive Design**
- Works seamlessly on desktop, tablet, and mobile devices
- User-friendly interface with modern design
- Compact recipe cards optimized for mobile viewing

## Prerequisites

- Python 3.8 or higher
- Google Cloud Platform account with Speech-to-Text API enabled
- Google AI Studio account for Gemini API access
- **Supabase account** for cloud database

## Setup Instructions

### 1. Clone or Download the Project

```bash
cd recipediary
```

### 2. Install Python Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Set Up Google Cloud Speech-to-Text API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Cloud Speech-to-Text API**
4. Create a service account:
   - Go to **IAM & Admin** > **Service Accounts**
   - Click **Create Service Account**
   - Give it a name and grant it the **Cloud Speech Client** role
   - Create and download the JSON key file
5. Save the JSON key file in a secure location

### 4. Set Up Google Gemini API

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **Get API Key**
3. Create a new API key or use an existing one
4. Copy the API key

### 5. Set Up Supabase Database

#### Create Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Click **Start your project** and sign up/sign in
3. Click **New Project**
4. Fill in project details:
   - **Name**: Recipe Diary (or any name)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to you
5. Click **Create new project** and wait for setup to complete

#### Create the Recipes Table

1. In your Supabase project, go to **SQL Editor**
2. Click **New query**
3. Paste the following SQL schema:

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

-- Create index for faster searches
CREATE INDEX idx_recipes_recipe_name ON recipes (recipe_name);
CREATE INDEX idx_recipes_created_at ON recipes (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for development)
-- Note: In production, you should configure proper authentication and policies
CREATE POLICY "Allow all operations for now" ON recipes
FOR ALL
USING (true)
WITH CHECK (true);
```

4. Click **Run** to execute the query
5. Verify the table was created by going to **Table Editor** > **recipes**

#### Get Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **API Key (anon public)** - This is your public anonymous key

### 6. Configure Environment Variables

Create a `.env` file in the project directory:

```env
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
```

**Example:**
```env
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\YourName\Documents\google-cloud-key.json
GEMINI_API_KEY=AIzaSyABCDEFGHIJKLMNOP...
SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 7. Run the Application

```powershell
python app.py
```

The server will start at `http://localhost:5000`

### 8. Access the Application

Open your web browser and navigate to:
```
http://localhost:5000
```

## Usage Guide

### Recording Audio

1. Select your language from the dropdown (supports 25+ languages)
2. Click the **Start** button to begin recording
3. Speak your recipe description clearly
4. Use **Pause** to temporarily stop recording
5. Use **Resume** to continue recording
6. Click **Stop** when finished (or it will auto-stop at 5 minutes)
7. Preview your audio in the player
8. Click **Transcribe & Generate Recipe** to process the audio
9. Recipe is automatically saved to your gallery!

### Uploading Audio

1. Select your language from the dropdown
2. Click on the upload area or drag and drop an audio file
3. Preview the uploaded audio
4. Click **Transcribe & Generate Recipe** to process the audio
5. Recipe is automatically saved to your gallery!

### Managing Recipes in Gallery

1. Click the **📚 My Recipes** button to view all saved recipes
2. **Search**: Use the search bar to find recipes by name, author, or ingredients
3. **View**: Click any recipe card to open detailed view in modal
4. **Edit**: Click the Edit button to modify any field
   - All fields become editable with live preview
   - Click Save Changes to update the database
   - Click Cancel to discard changes
5. **Delete**: Click the Delete button to permanently remove a recipe
6. **Save as Image**: Download recipe as a shareable PNG image

### Recipe Tips for Best Results

When describing your recipe, include:
- **Recipe name** at the beginning
- **Ingredients** with quantities (e.g., "2 cups of flour")
- **Instructions** in sequential order
- **Prep time, cook time, and servings** if known
- **Tips or variations** if you have any

Example:
> "Today I'm making chocolate chip cookies. You'll need 2 cups of flour, 1 cup of sugar, half a cup of butter, 2 eggs, 1 teaspoon vanilla extract, half teaspoon baking soda, and 1 cup of chocolate chips. First, preheat the oven to 350 degrees. Mix the butter and sugar until creamy. Add eggs and vanilla. In a separate bowl, combine flour and baking soda. Gradually mix the dry ingredients into the wet ingredients. Fold in chocolate chips. Drop spoonfuls onto a baking sheet and bake for 10 to 12 minutes. Makes about 24 cookies. Prep time is 15 minutes, cook time is 12 minutes."

## Project Structure

```
recipediary/
├── app.py              # Flask backend with CRUD API
├── app.js              # Frontend JavaScript (recording, gallery, CRUD)
├── index.html          # Main HTML (record & gallery views)
├── styles.css          # Responsive CSS styles
├── requirements.txt    # Python dependencies
├── .env               # Environment variables (create this)
├── README.md          # This file
└── uploads/           # Temporary storage for uploaded files (auto-created)
```

## API Endpoints

The application provides the following REST API endpoints:

- `POST /api/process-recipe` - Transcribe audio and generate recipe
- `GET /api/recipes` - Get all recipes (supports ?search=query parameter)
- `GET /api/recipes/<id>` - Get a specific recipe
- `POST /api/recipes` - Create a new recipe manually
- `PUT /api/recipes/<id>` - Update an existing recipe
- `DELETE /api/recipes/<id>` - Delete a recipe
- `GET /api/health` - Health check endpoint

## Troubleshooting

### Microphone Access Issues
- Ensure your browser has permission to access the microphone
- Try using HTTPS or localhost (required by modern browsers)
- Check browser console for specific error messages

### Transcription Errors
- Ensure audio is clear with minimal background noise
- Speak clearly and at a moderate pace
- Select the correct language from the dropdown
- Check that your Google Cloud credentials are correctly configured
- Verify the Speech-to-Text API is enabled in your GCP project

### Gemini API Errors
- Verify your API key is correct and active
- Check your API quota in Google AI Studio
- Ensure you have an active internet connection

### Supabase Database Errors
- Verify SUPABASE_URL and SUPABASE_KEY in your .env file
- Check that the recipes table was created successfully
- Ensure Row Level Security policies are configured
- Check Supabase dashboard for any service issues
- Verify your internet connection

### Environment Variables Not Loading
- Make sure the `.env` file is in the project root directory
- Verify the path to your service account JSON file is correct
- Restart the Flask server after changing .env
- Check for typos in environment variable names

### Gallery Not Loading
- Check browser console for error messages
- Verify Supabase credentials are correct
- Ensure the recipes table exists in Supabase
- Check network tab for failed API requests

## Security Notes

⚠️ **Important Security Practices:**
- Never commit your `.env` file or API keys to version control
- Add `.env` and service account JSON files to `.gitignore`
- Keep your API keys secure and rotate them regularly
- Use environment-specific credentials for development and production
- **Configure proper Row Level Security (RLS)** in Supabase for production
- Consider adding user authentication for multi-user scenarios

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (iOS 14.3+)
- **Opera**: ✅ Full support

## API Costs

- **Google Cloud Speech-to-Text**: Free tier includes 60 minutes per month
- **Google Gemini API**: Free tier available with usage limits
- **Supabase**: Free tier includes 500MB database, 1GB file storage, 2GB bandwidth

Check current pricing:
- [Speech-to-Text Pricing](https://cloud.google.com/speech-to-text/pricing)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Supabase Pricing](https://supabase.com/pricing)

## Database Schema

The `recipes` table in Supabase has the following structure:

| Column       | Type      | Description                      |
|--------------|-----------|----------------------------------|
| id           | UUID      | Primary key (auto-generated)     |
| recipe_name  | TEXT      | Name of the recipe               |
| author       | TEXT      | Recipe author/creator            |
| description  | TEXT      | Brief description                |
| prep_time    | TEXT      | Preparation time                 |
| cook_time    | TEXT      | Cooking/baking time              |
| yield        | TEXT      | Number of servings               |
| ingredients  | JSONB     | Array of ingredient strings      |
| instructions | JSONB     | Array of instruction steps       |
| tips         | JSONB     | Array of cooking tips            |
| created_at   | TIMESTAMP | Auto-set on creation             |
| updated_at   | TIMESTAMP | Auto-updated on modification     |

## Future Enhancements

- 👤 User authentication and personal recipe collections
- � Share recipes via email or social media
- 🖨️ Improved print layouts
- 🏷️ Tags and categories for recipes
- ⭐ Recipe ratings and favorites
- 📊 Nutritional information extraction
- 🌐 Public recipe sharing community

## License

This project is open source and available for personal and educational use.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Google Cloud, Gemini API, and Supabase documentation
3. Ensure all dependencies are properly installed
4. Check that all environment variables are correctly configured

---

**Happy Cooking! 🍳👨‍🍳**
