# Local Development Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   Create a `.env.local` file in the project root with your Supabase credentials:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Get your Supabase credentials:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project (or create a new one)
   - Go to **Settings** → **API**
   - Copy:
     - **Project URL** → `VITE_SUPABASE_URL`
     - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   The app will be available at `http://localhost:5173`

## Required Environment Variables (Minimum)

These are the **minimum** required to run the app locally:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

## Optional Environment Variables

For full functionality, you can also add:

```env
# Google Maps (for address autocomplete)
VITE_GOOGLE_MAPS_API_KEY=AIza...

# Stripe (for payments)
VITE_STRIPE_STARTER_PRICE_ID=price_xxxxx
VITE_STRIPE_PRO_PRICE_ID=price_xxxxx
VITE_STRIPE_PRO_PLUS_PRICE_ID=price_xxxxx

# API URL (for local API testing)
VITE_API_URL=http://localhost:5173
```

## Troubleshooting

### White Screen / Blank Page

**Problem:** App shows a white screen when you open it.

**Solution:** 
1. Check that `.env.local` exists in the project root
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Make sure there are no typos in variable names
4. Restart the dev server after creating/editing `.env.local`

### "Missing Supabase environment variables" Error

**Problem:** Error message about missing environment variables.

**Solution:**
1. Create `.env.local` file in the project root (same directory as `package.json`)
2. Add your Supabase credentials (see above)
3. Restart the dev server: `npm run dev`

### Environment Variables Not Loading

**Important:** 
- Variables must start with `VITE_` to be exposed to the client
- File must be named `.env.local` (not `.env`)
- Restart dev server after changing environment variables
- Check browser console for specific error messages

## Testing API Routes Locally

To test API routes (like `/api/generate`), use Vercel CLI:

```bash
# Install Vercel CLI globally
npm i -g vercel

# Run Vercel dev server (handles API routes)
vercel dev
```

This will run both:
- Frontend dev server (Vite)
- API routes (matching production behavior)

## Next Steps

Once the app is running:
1. Test the landing page loads
2. Try creating an account
3. Test generating a listing (requires API keys for full functionality)
4. Check browser console for any errors

## Need Help?

- Check browser console (F12) for error messages
- Verify all environment variables are set correctly
- Make sure Supabase project is active and accessible
- Ensure database migrations have been run (see `supabase/migrations/`)

