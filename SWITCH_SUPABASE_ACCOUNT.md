# Switch to Correct Supabase Account

## Overview
Your code doesn't have hardcoded Supabase URLs - everything uses environment variables. To switch to the correct Supabase account, you just need to update environment variables and run migrations.

## Step 1: Get Your Correct Supabase Credentials

1. **Go to your correct Supabase project:**
   - https://supabase.com/dashboard
   - Select the project you want to use

2. **Get your credentials:**
   - Go to **Settings** → **API**
   - Copy these values:
     - **Project URL**: `https://xxxxx.supabase.co`
     - **anon public key**: The `anon` `public` key (starts with `eyJ...`)
     - **service_role key**: The `service_role` `secret` key (starts with `eyJ...`)

## Step 2: Update Vercel Environment Variables

1. **Go to Vercel Dashboard:**
   - Your Project → **Settings** → **Environment Variables**

2. **Update these variables:**
   ```
   VITE_SUPABASE_URL=https://your-correct-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-correct-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-correct-service-role-key
   ```

3. **Important:**
   - Make sure you're updating for the correct environment (Production/Preview)
   - Delete old variables if they exist with wrong values
   - Variable names must be exact (case-sensitive)

## Step 3: Run Database Migrations on Correct Project

Your database needs the tables and schema. Run migrations on your correct Supabase project:

### Option A: Via Supabase Dashboard (Easiest)

1. **Go to your correct Supabase project:**
   - https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Go to SQL Editor:**
   - Click **SQL Editor** in left sidebar

3. **Run migrations in order:**
   - Copy contents of `supabase/migrations/20251215025902_create_lowcountry_listings_schema.sql`
   - Paste and run in SQL Editor
   - Then run `supabase/migrations/20251218021751_optimize_rls_policies.sql`
   - Then run `supabase/migrations/20251218042829_add_virtual_staging_and_subscription_tiers.sql`

### Option B: Via Supabase CLI (If installed)

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Step 4: Configure OAuth Redirect URLs

1. **Go to Supabase Dashboard:**
   - **Authentication** → **URL Configuration**

2. **Add redirect URLs:**
   - **Site URL**: `https://your-vercel-domain.vercel.app`
   - **Redirect URLs**: Add:
     - `https://your-vercel-domain.vercel.app/dashboard`
     - `https://your-vercel-domain.vercel.app/**`

3. **Enable Google OAuth (if using):**
   - **Authentication** → **Providers** → **Google**
   - Enable Google provider
   - Add your Google OAuth credentials

## Step 5: Verify Storage Buckets

1. **Go to Storage in Supabase:**
   - **Storage** → Check if these buckets exist:
     - `property-photos` (for listing photos)
     - `staging-photos` (for virtual staging)

2. **Create buckets if missing:**
   - Click **New bucket**
   - Name: `property-photos` → **Public bucket** → Create
   - Name: `staging-photos` → **Public bucket** → Create

## Step 6: Redeploy on Vercel

1. **Go to Vercel Dashboard:**
   - **Deployments** tab
   - Click **Redeploy** on latest deployment
   - Or push a new commit to trigger redeploy

2. **Verify:**
   - Site loads without white screen
   - Can sign up/login
   - Database operations work

## Step 7: Test Everything

After switching accounts, test:

- [ ] Landing page loads
- [ ] Sign up works (creates user in correct Supabase)
- [ ] Sign in works
- [ ] Generate listing works (saves to correct database)
- [ ] Dashboard shows generations (from correct database)
- [ ] Virtual staging works (if configured)

## Troubleshooting

**Issue:** Still connecting to old Supabase
- **Fix:** Make sure you updated ALL three variables in Vercel
- **Fix:** Redeploy after updating variables
- **Fix:** Clear browser cache/localStorage

**Issue:** Database tables don't exist
- **Fix:** Run migrations on the correct Supabase project (Step 3)

**Issue:** OAuth redirect not working
- **Fix:** Update redirect URLs in Supabase (Step 4)
- **Fix:** Make sure Site URL matches your Vercel domain

**Issue:** Storage uploads fail
- **Fix:** Create storage buckets (Step 5)
- **Fix:** Check bucket permissions (should be public)

## Quick Checklist

- [ ] Updated `VITE_SUPABASE_URL` in Vercel
- [ ] Updated `VITE_SUPABASE_ANON_KEY` in Vercel
- [ ] Updated `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- [ ] Ran database migrations on correct project
- [ ] Configured OAuth redirect URLs
- [ ] Created storage buckets
- [ ] Redeployed on Vercel
- [ ] Tested sign up/login
- [ ] Tested listing generation

---

**Note:** Your code is already set up correctly - no code changes needed! Just update environment variables and run migrations on the correct Supabase project.




