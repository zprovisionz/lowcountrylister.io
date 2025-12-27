# Vercel Deployment Settings

## Recommended Settings

When importing your project to Vercel, use these settings:

### Framework Preset
**Select:** `Vite`

*(Vercel should auto-detect this, but if it doesn't, manually select "Vite")*

### Root Directory
**Set to:** `.` (dot) or leave **blank/default**

*(Since all your files are at the repository root, you don't need a subdirectory)*

### Build Settings (Auto-detected, but verify)

- **Framework Preset:** `Vite`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Root Directory:** `.` (or blank)

### Additional Settings

- **Node.js Version:** `20.x` (or latest LTS)
- **Environment Variables:** Add all required variables (see VERCEL_DEPLOYMENT.md)

## Quick Setup Steps

1. **Import Repository:**
   - Go to https://vercel.com/new
   - Import: `zprovisionz/lowcountrylister.io`

2. **Configure Project:**
   - Framework Preset: **Vite**
   - Root Directory: **.** (or leave blank)
   - Vercel will auto-fill the rest

3. **Add Environment Variables:**
   - Before deploying, add all required env vars
   - See `VERCEL_DEPLOYMENT.md` for complete list

4. **Deploy:**
   - Click "Deploy"
   - Wait ~2-3 minutes for build

## Verification

After deployment, check:
- ✅ Build logs show "Vite" framework
- ✅ Build completes successfully
- ✅ Site loads at `https://your-project.vercel.app`
- ✅ API routes work (test `/api/generate`)

## Troubleshooting

**If build fails:**
- Verify Framework Preset is set to "Vite"
- Check Root Directory is `.` or blank
- Ensure all dependencies are in `package.json`

**If auto-detection doesn't work:**
- Manually set Framework Preset to "Vite"
- Build Command: `npm run build`
- Output Directory: `dist`


