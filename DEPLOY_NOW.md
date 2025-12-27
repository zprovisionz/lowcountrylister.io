# Quick Deployment Guide - Lowcountry Listings AI

## 🚀 Deploy to Vercel in 5 Steps

### Step 1: Push to GitHub (if not already done)

```bash
# If you haven't created a GitHub repo yet:
# 1. Go to https://github.com/new
# 2. Create a new repository (e.g., "lowcountry-listings")
# 3. Then run:

git remote add origin https://github.com/YOUR_USERNAME/lowcountry-listings.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

**Option A: Via Vercel Dashboard (Recommended for first time)**
1. Go to https://vercel.com/signup (or login)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite settings
5. **Don't deploy yet** - we need to add environment variables first

**Option B: Via Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel
```

### Step 3: Add Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

#### Required (Minimum to test):
```
# Supabase (get from https://supabase.com/dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# AI (get from https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=AIza...

# Google Maps (get from https://console.cloud.google.com/)
GOOGLE_MAPS_API_KEY=AIza...

# Geocodio (get from https://www.geocod.io/)
GEOCODIO_API_KEY=xxxxx

# Security (generate a random string)
CRON_SECRET=your-random-secret-here-min-32-chars
```

#### Optional (for full functionality):
```
# Stripe (for payments - get from https://dashboard.stripe.com/)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PRO_PLUS_PRICE_ID=price_...

# Virtual Staging (get from staging provider)
STAGING_API_KEY=xxxxx
STAGING_API_KEY_FALLBACK=xxxxx
```

**Important:** Select environment (Production, Preview, Development) for each variable.

### Step 4: Deploy

1. Click "Deploy" in Vercel Dashboard
2. Wait for build to complete (~2-3 minutes)
3. Your site will be live at `https://your-project.vercel.app`

### Step 5: Post-Deployment Setup

1. **Supabase OAuth Setup:**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add redirect URL: `https://your-project.vercel.app/dashboard`

2. **Stripe Webhook (if using payments):**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-project.vercel.app/api/stripe/webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

3. **Verify Cron Jobs:**
   - Go to Vercel Dashboard → Settings → Cron Jobs
   - Verify `/api/process-staging-queue` and `/api/reset-monthly-quotas` are listed

## 🧪 Testing Checklist

After deployment, test:

- [ ] Landing page loads
- [ ] Sign up / Sign in works
- [ ] Generate listing flow works
- [ ] Dashboard shows generation history
- [ ] Virtual staging works (if Pro/Pro+)
- [ ] Error messages display properly
- [ ] Mobile responsive design works

## 🔧 Troubleshooting

**Build fails:**
- Check Vercel build logs
- Verify all dependencies in `package.json`
- Ensure TypeScript compiles: `npm run typecheck`

**API routes return 500:**
- Check Vercel Function logs
- Verify environment variables are set correctly
- Check API keys are valid

**Authentication not working:**
- Verify Supabase redirect URLs are configured
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

## 📝 Next Steps

1. Set up custom domain (optional)
2. Enable Vercel Analytics
3. Set up error tracking (Sentry, LogRocket)
4. Configure monitoring alerts

---

**Ready to deploy?** Follow steps 1-4 above, then test your live site!


