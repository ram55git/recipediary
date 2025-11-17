# Supabase Email Confirmation Fix

## Issue
Getting a 500 error when signing up: `POST https://lmthbkyiwtfbvjvtedjs.supabase.co/auth/v1/signup 500`

## Cause
Supabase email confirmation is enabled by default but requires SMTP configuration.

## Solution - Disable Email Confirmation (Development)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (`lmthbkyiwtfbvjvtedjs`)
3. Navigate to **Authentication** → **Providers**
4. Click on **Email** provider
5. Find **"Confirm email"** toggle
6. Turn it **OFF**
7. Click **Save**

## Solution - Configure SMTP (Production)

For production environments, you should configure SMTP:

1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. Configure your SMTP provider (SendGrid, Mailgun, AWS SES, etc.)
3. Example with Gmail:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: Your Gmail address
   - Password: App-specific password (not your Gmail password)
   - Sender email: Your Gmail address
   - Sender name: Your app name

4. Test the connection
5. Keep **"Confirm email"** enabled in **Providers** → **Email**

## Verification

After disabling email confirmation:
1. Try signing up with a new email
2. You should be logged in immediately without needing to confirm email
3. Check the browser console - no more 500 errors

## Alternative - Use Magic Link Instead

Instead of email/password with confirmation:
1. Go to **Authentication** → **Providers** → **Email**
2. Enable **"Enable email provider"**
3. Enable **"Confirm email"** OFF
4. Or use Magic Link login (passwordless)
