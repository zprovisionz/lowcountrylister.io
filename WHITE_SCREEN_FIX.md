# White Screen Fix - Environment Variables

## Problem
White screen is caused by missing or incorrectly named environment variables. The app throws an error on startup if Supabase variables are missing.

## Solution

### Required Environment Variables (Frontend - Must start with `VITE_`)

In Vercel Dashboard → Settings → Environment Variables, add:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Important:** These MUST be prefixed with `VITE_` for Vite to expose them to the client-side code.

### Optional Frontend Variables

```
VITE_STRIPE_STARTER_PRICE_ID=price_xxxxx
VITE_STRIPE_PRO_PRICE_ID=price_xxxxx
VITE_STRIPE_PRO_PLUS_PRICE_ID=price_xxxxx
VITE_API_URL=https://your-domain.vercel.app
```

### Backend Variables (No VITE_ prefix)

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
GEMINI_API_KEY=AIza...
GOOGLE_MAPS_API_KEY=AIza...
GEOCODIO_API_KEY=xxxxx
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STAGING_API_KEY=xxxxx
CRON_SECRET=xxxxx
```

## Quick Fix Steps

1. **Go to Vercel Dashboard:**
   - Your Project → Settings → Environment Variables

2. **Add/Update these variables:**
   - `VITE_SUPABASE_URL` (not `NEXT_PUBLIC_SUPABASE_URL`)
   - `VITE_SUPABASE_ANON_KEY` (not `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

3. **Redeploy:**
   - Go to Deployments tab
   - Click "Redeploy" on the latest deployment
   - Or push a new commit to trigger redeploy

## Verify Fix

After redeploying:
1. Open browser console (F12)
2. Check for errors - should see no Supabase errors
3. Page should load with content

## Common Issues

**Issue:** Still white screen after adding variables
- **Fix:** Make sure variables are set for the correct environment (Production/Preview)
- **Fix:** Redeploy after adding variables (they don't apply to existing deployments)

**Issue:** "Missing Supabase environment variables" error
- **Fix:** Check variable names exactly match: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Fix:** No typos in the values

**Issue:** Variables show in dashboard but app doesn't see them
- **Fix:** Ensure variables start with `VITE_` prefix
- **Fix:** Redeploy after adding variables


