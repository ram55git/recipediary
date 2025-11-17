# 🔧 Deployment Troubleshooting Guide

## Railway Deployment Errors

### ❌ Error: "No module named 'pyaudioop'" / "No module named 'audioop'"

**Cause:** Python 3.13 **removed** the `audioop` module (deprecated since Python 3.11). Railway was using Python 3.13.9, but `pydub` requires `audioop` which no longer exists in Python 3.13+.

**Solution:**
1. ✅ Created `runtime.txt` with `python-3.12.7` to force Python 3.12
2. ✅ Updated `nixpacks.toml` to use `python312` and install `ffmpeg`
3. ✅ Removed `ffmpeg` and `ffmpeg-python` from requirements.txt (system package, not Python package)
4. Commit and push:
   ```bash
   git add runtime.txt nixpacks.toml requirements.txt
   git commit -m "Fix Python 3.13 audioop issue - use Python 3.12"
   git push
   ```
5. Railway will rebuild with Python 3.12 and ffmpeg installed

**Technical Details:**
- `audioop` was a built-in C extension module in Python <= 3.12
- Python 3.13 removed it entirely (PEP 594)
- `pydub` hasn't been updated to work without it yet
- Solution: Use Python 3.12 until pydub releases a fix

**Verify:**
- Check Railway deployment logs for "Python 3.12.7"
- Should see "Installing ffmpeg"
- No more "ModuleNotFoundError: No module named 'audioop'"
- Test audio upload/recording features

---

### ❌ Error: "POST /auth/v1/signup 500" - Email Confirmation Error

**Cause:** Supabase email confirmation is enabled but SMTP is not configured.

**Solution (Quick - Development):**
1. Go to Supabase Dashboard → Your Project
2. **Authentication** → **Providers** → **Email**
3. Toggle **"Confirm email"** to **OFF**
4. Click **Save**
5. Try signing up again - should work immediately

**Solution (Proper - Production):**
1. Configure SMTP in **Authentication** → **Settings** → **SMTP Settings**
2. Use SendGrid, Mailgun, AWS SES, or Gmail
3. Keep email confirmation enabled

See `EMAIL_CONFIRMATION_FIX.md` for detailed instructions.

---

### ❌ Error: "Cannot read properties of null (reading 'auth')"

**Cause:** Supabase client not initialized properly. Usually happens when config.js fails to load.

**Solution:**
1. Check `/config.js` endpoint is accessible:
   ```bash
   curl https://your-app.railway.app/config.js
   ```
2. Should return JavaScript with `window.Config = {...}`
3. Verify environment variables are set in Railway:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
4. Check browser console for config loading errors
5. Ensure script loading order in `index.html`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="/config.js"></script>
   <script src="app.js"></script>
   ```

---

### ❌ Error: "Application failed to respond"

**Cause:** App not binding to correct host/port for Railway.

**Solution:**
1. ✅ `Procfile` already configured: `web: gunicorn app:app --bind 0.0.0.0:$PORT`
2. ✅ `app.py` uses `PORT` from environment
3. Check Railway logs for startup errors
4. Verify `gunicorn` is in `requirements.txt`

---

### ❌ Error: JWT verification failed

**Cause:** `SUPABASE_JWT_SECRET` not set or incorrect.

**Solution:**
1. Get JWT secret from Supabase Dashboard → Project Settings → API
2. Copy the **JWT Secret** (not the anon key!)
3. Add to Railway environment variables:
   ```
   SUPABASE_JWT_SECRET=your-jwt-secret-here
   ```
4. Restart deployment

**Verify:**
1. Login to app
2. Try creating a recipe
3. Check browser Network tab - should see 200 responses, not 401

---

### ❌ Error: Google Cloud credentials not found

**Cause:** `GOOGLE_CREDENTIALS_BASE64` not set in Railway.

**Solution:**
1. Encode your Google credentials JSON file:
   ```bash
   # Windows PowerShell
   $bytes = [System.IO.File]::ReadAllBytes("path\to\credentials.json")
   [Convert]::ToBase64String($bytes)
   ```
2. Copy the base64 string
3. Add to Railway environment variables:
   ```
   GOOGLE_CREDENTIALS_BASE64=paste-base64-here
   ```
4. Redeploy

**Verify:**
- Check Railway logs: "Google Cloud credentials loaded from base64"
- Test audio transcription feature

---

## Database Issues

### ❌ Error: "Failed to save recipe" / "Insert failed"

**Cause:** Row Level Security (RLS) policies not applied or user_id column missing.

**Solution:**
1. Run `supabase_auth_migration.sql` in Supabase SQL Editor
2. Go to Supabase Dashboard → SQL Editor → New Query
3. Copy contents of `supabase_auth_migration.sql`
4. Run the query
5. Verify:
   - `recipes` table has `user_id` column (UUID)
   - RLS is enabled on `recipes` table
   - 4 policies exist: SELECT, INSERT, UPDATE, DELETE

**Check in Supabase:**
- Table Editor → `recipes` → should show `user_id` column
- Authentication → Policies → `recipes` → should show 4 policies

---

### ❌ Error: "User can see other users' recipes"

**Cause:** RLS policies not working or not applied.

**Solution:**
1. Verify RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'recipes';
   ```
   - `rowsecurity` should be `true`

2. Check policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'recipes';
   ```
   - Should show 4 policies

3. Test policy:
   - Login as User A, create recipe
   - Logout, login as User B
   - Should NOT see User A's recipes

---

## Frontend Issues

### ❌ App allows actions without login

**Cause:** Login requirement checks missing or auth state not initialized.

**Solution:**
1. ✅ Already fixed in `app.js`
2. Check browser console for:
   ```
   Please login to use this feature
   ```
3. Verify buttons are disabled when logged out
4. Check `currentUser` and `authToken` are set after login

**Verify:**
- Logout (or open incognito)
- All feature buttons should be disabled
- Auth prompt banner should appear
- Clicking any feature button should open login modal

---

### ❌ Config not loading / CORS errors

**Cause:** `/config.js` endpoint not accessible or CORS not configured.

**Solution:**
1. ✅ `flask-cors` already installed and configured
2. Test endpoint directly:
   ```bash
   curl https://your-app.railway.app/config.js
   ```
3. Should return JavaScript with config
4. Check Railway logs for CORS errors
5. Verify `CORS(app)` is in `app.py`

---

## Testing Checklist

After deployment, test these features:

### Authentication Flow
- [ ] Signup with new email works (no 500 error)
- [ ] Login with existing email works
- [ ] JWT token stored in browser
- [ ] Logout clears token
- [ ] Session persists on page reload

### Protected Features
- [ ] Recording requires login
- [ ] File upload requires login
- [ ] Gallery requires login
- [ ] Buttons disabled when logged out
- [ ] Auth modal opens when trying protected action

### Database Operations
- [ ] Can create new recipe
- [ ] Can view own recipes in gallery
- [ ] Cannot see other users' recipes
- [ ] Can edit own recipe
- [ ] Can delete own recipe

### Audio Processing
- [ ] Microphone recording works
- [ ] Audio file upload works
- [ ] Transcription generates text
- [ ] Recipe generation works

---

## Railway Logs

**View logs:**
1. Go to Railway Dashboard → Your Project
2. Click on your service
3. Click **Deployments** tab
4. Click latest deployment → **View Logs**

**Common log messages:**

✅ Good:
```
Loading environment variables from Railway
Google Cloud credentials loaded from base64
Supabase client initialized
Running on http://0.0.0.0:5000
```

❌ Bad:
```
ModuleNotFoundError: No module named 'pyaudioop'
SUPABASE_JWT_SECRET not set
Failed to decode Google credentials
Port 5000 already in use
```

---

## Quick Fixes Summary

| Error | Quick Fix |
|-------|-----------|
| Email 500 error | Disable email confirmation in Supabase |
| Missing audio modules | Add `nixpacks.toml` with ffmpeg |
| JWT verification fails | Set `SUPABASE_JWT_SECRET` in Railway |
| Google credentials error | Set `GOOGLE_CREDENTIALS_BASE64` in Railway |
| RLS not working | Run `supabase_auth_migration.sql` |
| Config not loading | Check `/config.js` endpoint and CORS |
| App won't start | Check `Procfile` and `PORT` variable |

---

## Getting Help

Still stuck? Check:
1. Railway deployment logs (most important!)
2. Browser console (F12) for frontend errors
3. Supabase logs in Dashboard → Logs
4. Network tab (F12) for API errors

Common pattern:
```
Railway logs → Find exact error message → Check this guide → Apply fix → Redeploy
```
