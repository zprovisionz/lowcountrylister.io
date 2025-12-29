# 🏠 Lowcountry Listings AI — Master Project Prompt

## Overview

**Lowcountry Listings AI** is a SaaS web application that generates professional real estate listing descriptions for properties in the Charleston, South Carolina (Lowcountry) area. It uses AI to create MLS-ready descriptions, Airbnb/VRBO listings, and social media captions with hyper-local Charleston neighborhood intelligence.

**Target Users:** Real estate agents, property managers, and Airbnb hosts in the Charleston metro area.

**Core Value Proposition:** Generate listing descriptions in under 30 seconds that include authentic Charleston terminology, verified distances to landmarks, and neighborhood-specific insights.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS 3.4 with custom CSS animations |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Database** | Supabase (PostgreSQL with Row Level Security) |
| **Authentication** | Supabase Auth (Email/Password + Google OAuth) |
| **AI/LLM** | OpenAI GPT-4o-mini (description generation, fact-checking) |
| **Vision AI** | OpenAI Vision API (photo feature extraction) |
| **Geocoding** | Geocod.io API + Google Maps Distance Matrix API |
| **Payments** | Stripe (subscriptions + checkout) |
| **Hosting** | Vercel |
| **Icons** | Lucide React |
| **Validation** | Zod |

---

## Design System & Styling

### Color Palette

```css
--color-primary: #0ea5e9;      /* Sky blue - primary actions */
--color-primary-dark: #0284c7; /* Darker blue - hover states */
--color-accent: #f59e0b;       /* Amber - pro features, highlights */
--color-success: #10b981;      /* Emerald - success states */
--color-bg-dark: #0f172a;      /* Slate 900 - dark background */
--color-bg-card: rgba(30, 41, 59, 0.7); /* Semi-transparent cards */
--color-border: rgba(71, 85, 105, 0.5); /* Subtle borders */
```

### Visual Style

- **Theme:** Dark mode with blue/cyan gradient accents
- **Background:** Multi-layer gradient with radial blue glow at top, horizontal gradient at bottom
- **Cards:** Glass morphism effect (`backdrop-blur`, semi-transparent backgrounds)
- **Borders:** Subtle gray borders with color-coded hover states
- **Typography:** System fonts with bold headings, gray-300/400 for body text
- **Glow Effects:** Blue glow on primary buttons, success glow on completion states

### Animation System

Custom keyframe animations for polished UX:

- `fadeIn`, `fadeInUp`, `fadeInDown` - Entry animations
- `scaleIn`, `scaleInBounce` - Modal/card appearances
- `slideInRight`, `slideInLeft` - Lateral transitions
- `pulse-glow` - Loading/active states
- `shimmer` - Skeleton loading placeholders
- `float` - Subtle floating effect for icons
- `success-pop` - Completion celebrations
- `shake` - Error feedback

Animation delays for staggered reveals: `delay-75` through `delay-500`

### Component Patterns

- **Buttons:** `btn-glow` (gradient glow on hover), `btn-ripple` (click feedback)
- **Cards:** `card-hover` (lift + shadow on hover), `glass` (backdrop blur)
- **Inputs:** `input-glow` (blue focus ring)
- **Progress:** Animated progress bars with gradient fills
- **Tooltips:** CSS-only tooltips with smooth fade transitions

---

## Application Flow

### 1. Landing Page (`/`)

- Hero section with address autocomplete (Google Places API)
- Auto-generates listing when valid Charleston address detected
- Shows preview snippet for anonymous users (full description requires sign-up)
- Features section, pricing cards, testimonials, CTA

### 2. Authentication (`/login`)

- Email/password sign-up and sign-in
- Google OAuth integration
- Email confirmation flow
- Password reset functionality

### 3. Generate Listing (`/generate`)

- **4-Step Wizard:**
  1. **Property Basics:** Address (autocomplete), beds, baths, sqft, property type
  2. **Photos:** Upload up to 10 photos for AI analysis
  3. **Amenities:** Select from categorized list + custom amenities
  4. **Review:** Toggle Airbnb/Social outputs, generate
- **Quick Generate:** Generate with just address (auto-populates neighborhood amenities)
- Virtual staging integration for Pro/Pro+ users

### 4. Dashboard (`/dashboard`)

- View all past generations with address, date, property details
- Copy MLS descriptions to clipboard
- Edit & refine existing generations
- View full descriptions in modal

### 5. Account (`/account`)

- Profile information
- Subscription management (Stripe Customer Portal)
- Usage statistics

### 6. Pricing (`/pricing`)

- Plan comparison cards
- Stripe Checkout integration

---

## Features

### Core Features

1. **MLS Description Generation** - 350-450 word professional listings
2. **Neighborhood Intelligence** - Local landmarks, schools, parks, driving times
3. **Photo Analysis** - AI extracts features from uploaded property photos
4. **Authenticity Scoring** - Validates Charleston-specific terminology usage
5. **Confidence Scoring** - Fact-checks descriptions against provided data (97%+ accuracy target)

### Pro Features

1. **Airbnb/VRBO Descriptions** - Guest-focused 200-250 word descriptions
2. **Social Media Captions** - 3 Instagram/Facebook captions with hashtags
3. **Virtual Staging** - AI-powered room staging with multiple styles:
   - Coastal Modern
   - Lowcountry Traditional
   - Contemporary
   - Minimalist

### Subscription Tiers

| Tier | Price | Generations | Staging | Formats |
|------|-------|-------------|---------|---------|
| **Free** | $0 | 3/month | None | MLS only |
| **Starter** | $9/mo | 50/month | 3 credits | MLS only |
| **Pro** | $19/mo | Unlimited | 15 credits/mo | All formats |
| **Pro+** | $29/mo | Unlimited | 50 credits/mo | All formats + buy more |

---

## Database Schema (Supabase/PostgreSQL)

### Tables

#### `user_profiles`

Links to `auth.users`, stores subscription tier, usage counters.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | FK to auth.users |
| `email` | text | User email |
| `subscription_tier` | text | 'free', 'starter', 'pro', 'pro_plus' |
| `generations_this_month` | integer | Monthly generation counter |
| `staging_credits_used_this_month` | integer | Monthly staging counter |
| `staging_credits_bonus` | integer | Purchased bonus credits |
| `stripe_customer_id` | text | Stripe customer reference |
| `stripe_subscription_id` | text | Active subscription reference |
| `billing_period_start` | timestamptz | Start of billing cycle |
| `last_reset_date` | timestamptz | Last quota reset |

#### `generations`

Stores all listing generations with full metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `address` | text | Property address |
| `bedrooms` | integer | Number of bedrooms |
| `bathrooms` | numeric | Number of bathrooms |
| `square_feet` | integer | Property size |
| `property_type` | text | Property classification |
| `amenities` | jsonb | Selected amenities array |
| `photo_urls` | jsonb | Uploaded photo URLs |
| `mls_description` | text | Generated MLS description |
| `airbnb_description` | text | Generated Airbnb description |
| `social_captions` | jsonb | Generated social captions |
| `confidence_score` | numeric | Fact-check score 0-100 |
| `confidence_level` | text | 'high' or 'medium' |
| `geocoding_data` | jsonb | Lat/lng and distances |
| `neighborhood_data` | jsonb | Detected neighborhood info |
| `staged_images` | jsonb | Virtual staging results |
| `created_at` | timestamptz | Creation timestamp |

#### `anonymous_generations`

Stores generations for non-authenticated users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `session_id` | text | Browser session identifier |
| `ip_address` | text | Hashed IP for rate limiting |
| `device_fingerprint` | text | Hashed device signature |
| `generation_count` | integer | Usage counter |
| `address` | text | Property address |
| `mls_description` | text | Full description (hidden) |
| `preview_snippet` | text | First 50 words (shown) |
| `expires_at` | timestamptz | 24-hour expiration |
| `linked_user_id` | uuid | Linked after sign-up |

#### `staging_queue`

Async staging job processing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `generation_id` | uuid | Associated generation |
| `photo_url` | text | Original photo URL |
| `room_type` | text | Detected/selected room type |
| `style` | text | Staging style choice |
| `status` | text | 'pending', 'processing', 'completed', 'failed' |
| `staged_url` | text | Result image URL |
| `provider` | text | API provider used |
| `error_message` | text | Error details if failed |

#### `staging_rate_limits`

Abuse prevention for staging requests.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid | Primary key, FK to auth.users |
| `requests_last_hour` | integer | Rolling hourly count |
| `failed_attempts_today` | integer | Daily failure count |
| `is_suspended` | boolean | Temporary suspension flag |
| `suspension_until` | timestamptz | Suspension expiry |

### Security

- Row Level Security (RLS) on all tables
- Users can only access their own data
- Service role for backend API operations

---

## API Architecture (Vercel Serverless)

### Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/generate` | POST | Bearer | Generate listing (authenticated) |
| `/api/generate-anonymous` | POST | None | Generate preview (3 free) |
| `/api/get-generation` | GET | Bearer | Fetch generation by ID |
| `/api/check-quota` | POST | Bearer | Check/reset monthly quota |
| `/api/stage-photo` | POST | Bearer | Queue virtual staging job |
| `/api/staging-status` | GET | Bearer | Poll staging job status |
| `/api/link-anonymous-sessions` | POST | Bearer | Link anon generations to user |
| `/api/stripe/create-checkout` | POST | Bearer | Create Stripe checkout session |
| `/api/stripe/create-portal` | POST | Bearer | Create Stripe billing portal |
| `/api/stripe/webhook` | POST | Stripe | Handle subscription events |

### Generation Pipeline

1. **Validate** input with Zod schema
2. **Check quota** - verify user can generate
3. **Geocode** address (Geocod.io)
4. **Get driving distances** to landmarks (Google Maps Distance Matrix)
5. **Detect neighborhood** from coordinates/zip/address
6. **Extract photo features** (OpenAI Vision API)
7. **Load few-shot examples** for prompt engineering
8. **Generate descriptions** (GPT-4o-mini)
9. **Fact-check** all outputs
10. **Save** to database
11. **Increment** usage counter

---

## Charleston Neighborhood Intelligence

### Data Structure (`charleston_neighborhoods.json`)

Each neighborhood includes:

- `name`, `aliases`, `zip_codes`
- `bounds` (lat/lng bounding box)
- `description`, `vibes`
- `landmarks`, `attractions`, `parks`, `schools`
- `proximities` (to beaches, downtown, etc.)
- `typical_amenities` (auto-populated for quick generate)
- `vocabulary` (local terms: "piazza" instead of "porch")
- `selling_points`

### Key Landmarks for Distance Calculation

- Shem Creek
- Downtown/King Street
- Sullivan's Island Beach
- Isle of Palms Beach
- Folly Beach
- Ravenel Bridge
- Angel Oak
- Magnolia Plantation

### Authenticity Validation

Checks for Charleston-specific terminology:

- "Lowcountry", "Holy City", "piazza", "marsh", "live oak", "peninsula"
- Neighborhood name mentions
- Suggests improvements for low-scoring descriptions

---

## Authentication Flow

### Supabase Auth

- **Sign Up:** Email/password with confirmation email
- **Sign In:** Email/password or Google OAuth
- **Session:** JWT tokens, automatic refresh
- **Profile Creation:** Auto-creates `user_profiles` on first sign-in

### Anonymous → Authenticated Conversion

1. Anonymous user generates listing (stored with `session_id` cookie)
2. User signs up
3. `linkAnonymousSession()` links previous generations to new account
4. Full descriptions unlocked

---

## Key Business Logic

### Quota Enforcement

```typescript
// Free: 3 generations/month
// Starter: 50 generations/month
// Pro/Pro+: Unlimited

// Monthly reset on billing_period_start anniversary
```

### Rate Limiting (Anonymous)

- 3 generations per IP+device fingerprint per 24 hours
- Hashed IP storage for privacy
- Preview-only output (first 50 words)

### Staging Credits

- Tracked separately from generations
- Pro: 15/month, Pro+: 50/month
- Bonus credits purchasable for Pro+ users

---

## File Structure

```
src/
├── App.tsx              # Router + AuthProvider wrapper
├── main.tsx             # React entry point
├── index.css            # Tailwind + custom animations
├── pages/
│   ├── Landing.tsx      # Homepage with hero + features
│   ├── Login.tsx        # Auth forms
│   ├── GenerateListing.tsx  # 4-step wizard
│   ├── Dashboard.tsx    # Generation history
│   ├── Account.tsx      # User settings
│   └── Pricing.tsx      # Plan comparison
├── components/
│   ├── steps/           # Wizard step components
│   │   ├── PropertyBasicsStep.tsx
│   │   ├── PhotosStep.tsx
│   │   ├── AmenitiesStep.tsx
│   │   ├── ReviewStep.tsx
│   │   └── StepIndicator.tsx
│   ├── ui/              # Reusable UI components
│   │   ├── Alert.tsx
│   │   ├── Button.tsx
│   │   └── Skeleton.tsx
│   ├── AddressAutocompleteInput.tsx
│   ├── AmenitiesSelector.tsx
│   ├── ErrorBoundary.tsx
│   ├── GenerationProgress.tsx
│   ├── Notification.tsx
│   ├── PhotoUploader.tsx
│   ├── ResultsDisplay.tsx
│   ├── StagingPhotoSelector.tsx
│   ├── StagingResults.tsx
│   ├── StagingStylePicker.tsx
│   ├── StructuredData.tsx
│   ├── UpgradeModal.tsx
│   └── VirtualStaging.tsx
├── contexts/
│   └── AuthContext.tsx  # Auth state management
├── services/
│   └── neighborhoodService.ts  # Neighborhood detection
├── hooks/
│   └── useGooglePlacesAutocomplete.ts
├── lib/
│   ├── supabase.ts      # Supabase client + types
│   ├── errorHandler.ts  # API error handling
│   ├── logger.ts        # Logging utility
│   ├── loadGoogleMaps.ts
│   ├── propertyTypes.ts
│   └── watermark.ts
└── data/
    ├── charleston_neighborhoods.json
    ├── charleston_neighborhoods_expanded.json
    ├── charleston_fewshot_examples.ts
    └── sc_addresses.ts

api/
├── generate.ts              # Authenticated generation
├── generate-anonymous.ts    # Anonymous generation
├── get-generation.ts        # Fetch by ID
├── check-quota.ts           # Quota management
├── stage-photo.ts           # Virtual staging
├── staging-status.ts        # Staging job polling
├── link-anonymous-sessions.ts
├── cleanup-expired-anonymous.ts
├── reset-monthly-quotas.ts
├── process-staging-queue.ts
├── stripe/
│   ├── create-checkout.ts
│   ├── create-portal.ts
│   └── webhook.ts
└── _lib/
    ├── supabase.ts          # Server-side Supabase client
    ├── quota.ts             # Quota checking utilities
    ├── validation.ts        # Zod schemas
    ├── vision.ts            # OpenAI Vision integration
    ├── fingerprint.ts       # Device fingerprinting
    ├── rateLimit.ts         # Rate limiting
    ├── neighborhoodCache.ts # Neighborhood caching
    ├── staging-provider.ts  # Staging API integration
    ├── logger.ts            # Server logging
    └── types.ts             # Shared types

supabase/
└── migrations/
    ├── 20251215025902_create_lowcountry_listings_schema.sql
    ├── 20251218021751_optimize_rls_policies.sql
    ├── 20251218042829_add_virtual_staging_and_subscription_tiers.sql
    └── 20251227192645_add_anonymous_generations.sql
```

---

## Development Commands

```bash
npm run dev      # Start Vite dev server (localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
npm run typecheck # TypeScript check
```

---

## Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...

# Google Maps (for Places Autocomplete + Distance Matrix)
GOOGLE_MAPS_API_KEY=AIza...
VITE_GOOGLE_MAPS_API_KEY=AIza...  # Client-side for autocomplete

# Geocoding
GEOCODIO_API_KEY=your-geocodio-key

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Deployment (Vercel)

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. Deploy

### Vercel Configuration (`vercel.json`)

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

---

## Future Enhancements (Roadmap)

- [ ] Team/brokerage accounts with shared generations
- [ ] Bulk generation for multiple properties
- [ ] MLS direct integration (API export)
- [ ] Custom branding/templates
- [ ] Analytics dashboard (views, copies, engagement)
- [ ] Mobile app (React Native)
- [ ] Additional markets beyond Charleston

---

This master prompt provides a complete foundation for understanding, extending, or maintaining the Lowcountry Listings AI application. Use it as a reference when adding new features, onboarding contributors, or discussing the project with AI assistants.

