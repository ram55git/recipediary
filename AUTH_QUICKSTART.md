# 🚀 Quick Start: Enable Authentication

## 3 Simple Steps

### 1️⃣ Get JWT Secret
1. Go to: https://supabase.com/dashboard/project/lmthbkyiwtfbvjvtedjs/settings/api
2. Scroll to "JWT Settings"
3. Copy the "JWT Secret" value

### 2️⃣ Update .env
Add this line to your `.env` file:
```bash
SUPABASE_JWT_SECRET=paste_the_jwt_secret_here
```

### 3️⃣ Run SQL Migration
1. Go to: https://supabase.com/dashboard/project/lmthbkyiwtfbvjvtedjs/sql/new
2. Copy/paste contents from `supabase_auth_migration.sql`
3. Click "Run" (or Ctrl+Enter)

### 4️⃣ Restart Server
```bash
python app.py
```

## ✅ That's It!

Now test:
1. Click "Login" in the app
2. Create an account
3. Record a recipe
4. Go to "My Recipes" tab

---

## 📋 Checklist

- [ ] Got JWT Secret from Supabase
- [ ] Added to .env file
- [ ] Ran SQL migration
- [ ] Restarted Flask server
- [ ] Created test account
- [ ] Recorded test recipe
- [ ] Verified it appears in "My Recipes"

---

## 🆘 Troubleshooting

**"Authentication required" error**
→ Make sure you're logged in (top right corner)

**"Invalid token" error**
→ Double-check JWT Secret in .env matches Supabase dashboard

**Can't see recipes**
→ Login first, then recipes will appear

---

See `AUTHENTICATION_SETUP.md` for full details.
