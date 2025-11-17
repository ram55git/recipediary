# 🚂 Railway Deployment Guide

Complete guide to deploy Recipe Diary on Railway.app with environment-based configuration.

---

## 📋 Prerequisites

Before deploying, ensure you have:
- ✅ Railway account (https://railway.app)
- ✅ GitHub account (for connecting repository)
- ✅ Supabase project setup and running
- ✅ Google Cloud credentials
- ✅ Gemini API key

---

## 🔧 How Configuration Works

### Local Development
- Flask serves `/config.js` endpoint dynamically
- Reads `SUPABASE_URL` and `SUPABASE_KEY` from `.env` file
- Frontend loads config from `/config.js`
- No hardcoded credentials

### Railway Production
- Environment variables set in Railway dashboard
- Flask generates `/config.js` with Railway environment variables
- Frontend automatically uses production credentials
- Fully dynamic - no code changes needed

---

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

1. **Initialize Git** (if not already done):
```bash
cd "c:\Users\srira\Documents\ProjectDragon\python programs\recipediary"
git init
git add .
git commit -m "Initial commit - Recipe Diary with authentication"
```

2. **Push to GitHub**:
```bash
# Create a new repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/recipe-diary.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select your `recipe-diary` repository
4. Click **"Deploy Now"**

Railway will automatically:
- Detect Python project
- Install dependencies from `requirements.txt`
- Use `Procfile` to start the app with gunicorn

### Step 3: Configure Environment Variables

In Railway dashboard, go to your project → **Variables** tab and add:

#### Required Variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://lmthbkyiwtfbvjvtedjs.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_JWT_SECRET=your_supabase_jwt_secret_here

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Google Cloud Service Account (see below for special handling)
```

#### Google Cloud Credentials (Special Setup):

Railway doesn't support file uploads, so for `GOOGLE_APPLICATION_CREDENTIALS`:

**Option 1: Base64 Encode (Recommended)**
```bash
# On your local machine:
$base64Content = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your\service-account-key.json"))
echo $base64Content
```

Add to Railway:
```bash
GOOGLE_CREDENTIALS_BASE64=<paste the base64 string>
```

Then update `app.py` to decode it (see code below).

**Option 2: Use JSON String**
```bash
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

### Step 4: Update app.py for Railway

Add this code at the top of `app.py` after imports:

```python
import base64
import json

# Handle Google Cloud credentials for Railway
if os.getenv('GOOGLE_CREDENTIALS_BASE64'):
    # Decode base64 credentials
    creds_json = base64.b64decode(os.getenv('GOOGLE_CREDENTIALS_BASE64')).decode('utf-8')
    creds_path = '/tmp/google-credentials.json'
    with open(creds_path, 'w') as f:
        f.write(creds_json)
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path
elif os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON'):
    # Use JSON string directly
    creds_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
    creds_path = '/tmp/google-credentials.json'
    with open(creds_path, 'w') as f:
        f.write(creds_json)
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path
```

### Step 5: Deploy

1. **Push changes** to GitHub:
```bash
git add .
git commit -m "Add Railway deployment configuration"
git push
```

2. Railway will **automatically redeploy** when you push to GitHub

3. Wait for build to complete (check Deployments tab)

### Step 6: Access Your App

1. In Railway dashboard, click **"Generate Domain"**
2. Railway will provide a URL like: `recipe-diary-production.up.railway.app`
3. Click the URL to access your deployed app!

---

## 🔍 Verify Deployment

### Test Checklist:

- [ ] App loads without errors
- [ ] Login/Signup works
- [ ] Can record audio
- [ ] Transcription works
- [ ] Recipe generation works
- [ ] Recipes save to database
- [ ] Gallery shows saved recipes
- [ ] Edit/Delete works

### Check Health Endpoint:

Visit: `https://your-app.railway.app/api/health`

Should return:
```json
{
  "status": "healthy",
  "speech_to_text": true,
  "gemini": true,
  "database": true
}
```

---

## 🐛 Troubleshooting

### Issue: "Config is not defined"

**Solution:** Make sure `/config.js` is being loaded:
- Check browser console
- Visit `https://your-app.railway.app/config.js` directly
- Should show JavaScript with your Supabase credentials

### Issue: "500 Internal Server Error"

**Solution:** Check Railway logs:
1. Go to Railway dashboard
2. Click **Deployments** → Latest deployment
3. Click **View Logs**
4. Look for errors

Common causes:
- Missing environment variables
- Google credentials not properly decoded
- Supabase connection failed

### Issue: Authentication not working

**Solution:** Verify:
- `SUPABASE_JWT_SECRET` is correct
- JWT secret matches Supabase dashboard
- Check browser console for auth errors

### Issue: Transcription failing

**Solution:**
- Verify Google Cloud credentials are properly set
- Check if Speech-to-Text API is enabled in Google Cloud Console
- Review Railway logs for specific errors

---

## 📊 Monitoring

Railway provides built-in monitoring:

1. **Metrics**: CPU, Memory, Network usage
2. **Logs**: Real-time application logs
3. **Deployments**: History of all deployments

Access from Railway dashboard → Your project

---

## 💰 Costs

Railway Free Tier includes:
- $5 credit per month
- Up to 500 hours of usage
- Community support

**Typical Recipe Diary usage**: ~$3-5/month for moderate use

For production with heavy traffic, consider upgrading to Pro plan.

---

## 🔐 Security Best Practices

1. **Environment Variables**: Never commit `.env` to Git
2. **API Keys**: Rotate keys periodically
3. **JWT Secret**: Use strong, unique secret
4. **HTTPS**: Railway provides automatic HTTPS
5. **Row Level Security**: Already enabled in Supabase
6. **Rate Limiting**: Consider adding for production

---

## 🔄 Continuous Deployment

Railway auto-deploys on every push to `main` branch:

```bash
# Make changes
git add .
git commit -m "Your changes"
git push

# Railway automatically:
# 1. Detects push
# 2. Builds new image
# 3. Runs tests (if configured)
# 4. Deploys to production
# 5. Zero downtime
```

---

## 📱 Custom Domain (Optional)

1. Go to Railway project → **Settings** → **Domains**
2. Click **"Add Custom Domain"**
3. Enter your domain (e.g., `recipes.yoursite.com`)
4. Add DNS records to your domain registrar:
   - Type: `CNAME`
   - Name: `recipes`
   - Value: (provided by Railway)

---

## 🎯 Environment-Specific Features

### Development (.env file):
- Debug mode enabled
- Detailed error messages
- Hot reload

### Production (Railway):
- Debug mode disabled
- Production-grade gunicorn
- Auto-scaling
- HTTPS enforced
- Environment isolation

---

## 📝 Summary

Your Recipe Diary is now:
✅ **Fully deployed** on Railway
✅ **Environment-based config** - No hardcoded secrets
✅ **Auto-deploying** from GitHub
✅ **Secure** with HTTPS and auth
✅ **Scalable** with Railway infrastructure
✅ **Production-ready** for real users

---

## 🆘 Need Help?

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Supabase Docs**: https://supabase.com/docs
- **Google Cloud Docs**: https://cloud.google.com/docs

---

**Happy Deploying! 🚀**
