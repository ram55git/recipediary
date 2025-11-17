# 🚀 Quick Railway Deploy

## What Changed

✅ **No more hardcoded credentials!**
- Credentials now loaded from environment variables
- Flask serves `/config.js` dynamically with env vars
- Works seamlessly in both local and production

## Files Added/Modified

📄 **New Files:**
- `Procfile` - Railway deployment config
- `RAILWAY_DEPLOYMENT.md` - Full deployment guide

📝 **Modified:**
- `app.py` - Dynamic config endpoint, Google creds handling, PORT env var
- `index.html` - Loads config from `/config.js`
- `app.js` - Uses Config object instead of hardcoded values
- `requirements.txt` - Added gunicorn

## Local Testing

Everything still works locally:
```bash
python app.py
```

Credentials loaded from `.env` file as before.

## Railway Deployment (3 Steps)

### 1️⃣ Push to GitHub
```bash
git add .
git commit -m "Add Railway deployment"
git push
```

### 2️⃣ Deploy on Railway
1. Go to https://railway.app/new
2. Select your GitHub repo
3. Click "Deploy"

### 3️⃣ Add Environment Variables

In Railway dashboard → Variables:

```bash
SUPABASE_URL=https://lmthbkyiwtfbvjvtedjs.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_key
GOOGLE_CREDENTIALS_BASE64=<base64_of_json_file>
```

### Get Base64 of Google Credentials:
```powershell
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json"))
echo $base64
```

## ✅ Done!

Railway will automatically:
- Install dependencies
- Start with gunicorn
- Generate public URL
- Auto-deploy on push

---

See `RAILWAY_DEPLOYMENT.md` for detailed instructions.
