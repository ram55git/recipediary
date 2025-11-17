# 🔐 Authentication Setup Guide

This guide will walk you through enabling Supabase authentication for multi-user support in Recipe Diary.

## Overview

The application now supports:
- ✅ User registration and login
- ✅ Secure JWT token-based authentication
- ✅ Multi-user recipe isolation (users only see their own recipes)
- ✅ Row Level Security (RLS) at the database level
- ✅ Session persistence across page reloads

---

## Step 1: Update Your .env File

Add the Supabase JWT Secret to your `.env` file:

```bash
# Get this from Supabase Dashboard > Settings > API > JWT Settings > JWT Secret
SUPABASE_JWT_SECRET=your_jwt_secret_here
```

### How to Find Your JWT Secret:

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (`lmthbkyiwtfbvjvtedjs`)
3. Click **Settings** (gear icon) → **API**
4. Scroll down to **JWT Settings**
5. Copy the **JWT Secret** value
6. Paste it into your `.env` file

---

## Step 2: Run Database Migration

Execute the SQL migration to add authentication support:

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy and paste the contents of `supabase_auth_migration.sql`
5. Click **Run** (or press Ctrl+Enter)

### Option B: Using Supabase CLI

```bash
supabase db execute --file supabase_auth_migration.sql
```

### What the Migration Does:

- Adds `user_id` column to `recipes` table
- Creates indexes for performance
- Enables Row Level Security (RLS)
- Creates policies to ensure users can only access their own recipes

---

## Step 3: Enable Email Authentication in Supabase

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Ensure **Email** provider is enabled (it should be by default)
3. Configure email settings:
   - **Enable email confirmations** (recommended for production)
   - **Enable email change confirmations**
   - **Disable email signup** if you want invite-only access

### Email Templates (Optional)

Customize the email templates for a better user experience:
1. Go to **Authentication** → **Email Templates**
2. Customize:
   - Confirm signup
   - Magic Link
   - Reset password

---

## Step 4: Install Python Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

New packages added:
- `PyJWT==2.8.0` - For JWT token verification
- `cryptography==41.0.7` - For cryptographic operations

---

## Step 5: Update app.js with Your Supabase Credentials

Open `app.js` and update lines 9-10 with your Supabase credentials:

```javascript
const SUPABASE_URL = 'https://lmthbkyiwtfbvjvtedjs.supabase.co'; // Your URL
const SUPABASE_ANON_KEY = 'your_anon_key_here'; // Your anon key
```

**Security Note:** For production, these should be environment variables. For now, they're hardcoded since the anon key is safe to expose (it's designed for client-side use).

---

## Step 6: Test the Authentication

1. **Start the Flask server:**
   ```bash
   python app.py
   ```

2. **Open the app:** http://localhost:5000

3. **Create a test account:**
   - Click **Login** button in the top right
   - Switch to **Sign Up** tab
   - Enter email and password (min 6 characters)
   - Click **Create Account**
   - Check your email for verification link (if email confirmation enabled)

4. **Login:**
   - Enter your email and password
   - Click **Login**
   - You should see your email displayed in the header

5. **Record a recipe:**
   - Record or upload audio
   - Transcribe and generate recipe
   - Recipe should automatically save to database with your user_id

6. **View your recipes:**
   - Click **My Recipes** tab
   - You should see only your recipes
   - Try searching and editing

7. **Test multi-user isolation:**
   - Open app in incognito/private browser
   - Create a different account
   - Record a recipe
   - Verify that each user only sees their own recipes

---

## Step 7: Handle Existing Recipes (If Any)

If you have existing recipes without `user_id`, you have three options:

### Option A: Assign to Your User Account

1. Login to get your user ID
2. Run this SQL in Supabase:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE recipes 
SET user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
WHERE user_id IS NULL;
```

### Option B: Delete Existing Recipes

```sql
DELETE FROM recipes WHERE user_id IS NULL;
```

### Option C: Create a "System" User

1. Create a dedicated user account via the app
2. Note the user_id
3. Run:

```sql
UPDATE recipes 
SET user_id = 'user-id-here'
WHERE user_id IS NULL;
```

---

## Troubleshooting

### "Authentication required" Error

**Cause:** JWT token not being sent with API requests

**Solutions:**
1. Make sure you're logged in (check top right)
2. Refresh the page to ensure auth state is loaded
3. Check browser console for errors
4. Verify `authToken` is set in app.js (check in browser dev tools)

### "Invalid token" Error

**Cause:** JWT secret mismatch

**Solutions:**
1. Verify `SUPABASE_JWT_SECRET` in `.env` matches Supabase dashboard
2. Restart Flask server after updating `.env`
3. Ensure no extra spaces or quotes in the secret

### "Recipe not found or unauthorized"

**Cause:** Trying to access another user's recipe

**This is normal behavior!** Each user can only access their own recipes.

### Email Not Sending

**Cause:** Email confirmation enabled but SMTP not configured

**Solutions:**
1. For development: Disable email confirmation in Supabase **Authentication** → **Providers** → **Email**
2. For production: Configure SMTP in **Project Settings** → **Auth** → **SMTP Settings**

### Can't See Gallery

**Cause:** Not logged in

**Solution:** Click **Login** and sign in with your account

---

## Security Features

✅ **JWT Token Verification** - All API requests verified server-side

✅ **Row Level Security** - Database-level access control

✅ **User Isolation** - Users can only see/edit/delete their own recipes

✅ **Secure Password Storage** - Handled by Supabase (bcrypt hashing)

✅ **Token Expiration** - Tokens automatically expire and refresh

✅ **HTTPS Required** - Supabase requires HTTPS in production

---

## Production Deployment Checklist

- [ ] Enable email confirmations in Supabase
- [ ] Configure custom SMTP for emails
- [ ] Set up custom domain for auth redirects
- [ ] Add CAPTCHA for signup (Supabase supports hCaptcha)
- [ ] Configure password strength requirements
- [ ] Set up rate limiting
- [ ] Enable 2FA (optional, but recommended)
- [ ] Move Supabase credentials to environment variables
- [ ] Set up monitoring and logging

---

## Next Steps

1. **Test thoroughly** - Create multiple accounts and test all features
2. **Customize email templates** - Make them match your brand
3. **Add social login** - Supabase supports Google, GitHub, etc.
4. **Implement password reset** - Frontend UI needed
5. **Add user profiles** - Store display names, avatars, etc.

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase Auth documentation: https://supabase.com/docs/guides/auth
3. Check browser console for JavaScript errors
4. Check Flask terminal for backend errors
5. Verify all environment variables are set correctly

---

**Congratulations! 🎉** Your Recipe Diary now supports multi-user authentication!
