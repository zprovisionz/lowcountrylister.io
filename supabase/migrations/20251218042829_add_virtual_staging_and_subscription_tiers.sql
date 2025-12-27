/*
  # Add Virtual Staging and Enhanced Subscription Features

  ## Overview
  Extends the database to support professional-grade virtual staging, enhanced subscription tiers,
  and comprehensive usage tracking. This enables the V1 production feature set with proper cost
  controls and user experience parity with leading SaaS competitors.

  ## Changes to Existing Tables

  ### `user_profiles` - New Columns
  - `subscription_tier` (text) - Replaces 'plan' with expanded tiers: 'free', 'starter', 'pro', 'pro_plus'
  - `stripe_customer_id` (text) - Links user to Stripe customer for billing
  - `stripe_subscription_id` (text) - Active Stripe subscription identifier
  - `last_reset_date` (timestamptz) - Tracks monthly billing period reset for accurate quota management
  - `staging_credits_used_this_month` (integer) - Separate counter for staging usage
  - `staging_credits_bonus` (integer) - Additional staging credits from purchased packs
  - `total_stagings_generated` (integer) - Lifetime staging count for analytics
  - Drop old `plan` column in favor of `subscription_tier`

  ### `generations` - New Columns
  - `staged_images` (jsonb) - Array of staging results with metadata
  - `confidence_score` (numeric) - Fact-check confidence rating 0-100
  - `neighborhood_data` (jsonb) - Stores Charleston neighborhood context used
  - `geocoding_data` (jsonb) - Stores lat/lng and distances to landmarks

  ## New Tables

  ### `staging_queue`
  Manages asynchronous virtual staging requests with provider integration:
  - `id` (uuid, PK) - Queue entry identifier
  - `user_id` (uuid, FK) - User who requested staging
  - `generation_id` (uuid, FK) - Associated listing generation (nullable for standalone requests)
  - `photo_url` (text) - Original photo URL to be staged
  - `room_type` (text) - Detected/selected room type (living_room, bedroom, etc.)
  - `style` (text) - Staging style (coastal_modern, lowcountry_traditional, etc.)
  - `status` (text) - Processing status: pending, processing, completed, failed
  - `staged_url` (text) - Result image URL when completed
  - `provider` (text) - Which API provider was used (reimagine, virtualstagingai)
  - `provider_job_id` (text) - External API job identifier for tracking
  - `error_message` (text) - Error details if failed
  - `processing_time_seconds` (integer) - Performance tracking
  - `created_at` (timestamptz) - Request timestamp
  - `completed_at` (timestamptz) - Completion timestamp

  ### `staging_rate_limits`
  Tracks rate limiting to prevent abuse and control costs:
  - `user_id` (uuid, PK, FK) - User identifier
  - `requests_last_hour` (integer) - Rolling hourly request count
  - `last_request_at` (timestamptz) - Most recent request timestamp
  - `failed_attempts_today` (integer) - Daily failed request count for anomaly detection
  - `is_suspended` (boolean) - Temporary suspension flag for abuse
  - `suspension_until` (timestamptz) - When suspension expires

  ## Security
  - Enable RLS on all new tables
  - Users can only access their own staging queue entries
  - Users can only view their own rate limit data
  - All policies check authentication and ownership
  - Service role access required for queue processing

  ## Indexes
  - Optimize staging queue lookups by status and user
  - Index rate limit lookups by user and timestamp
  - Index generations by confidence_score for quality analytics
*/

-- ============================================================================
-- 1. UPDATE user_profiles TABLE
-- ============================================================================

-- Add new subscription and staging columns
DO $$
BEGIN
  -- Add subscription_tier column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free' 
      CHECK (subscription_tier IN ('free', 'starter', 'pro', 'pro_plus'));
  END IF;

  -- Add Stripe integration columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_subscription_id text;
  END IF;

  -- Add staging tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_reset_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_reset_date timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'staging_credits_used_this_month'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN staging_credits_used_this_month integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'staging_credits_bonus'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN staging_credits_bonus integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'total_stagings_generated'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN total_stagings_generated integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Migrate existing 'plan' data to 'subscription_tier' if plan column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'plan'
  ) THEN
    UPDATE user_profiles SET subscription_tier = plan WHERE subscription_tier = 'free';
    ALTER TABLE user_profiles DROP COLUMN plan;
  END IF;
END $$;

-- ============================================================================
-- 2. UPDATE generations TABLE
-- ============================================================================

-- Add staging and enrichment columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'staged_images'
  ) THEN
    ALTER TABLE generations ADD COLUMN staged_images jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE generations ADD COLUMN confidence_score numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'neighborhood_data'
  ) THEN
    ALTER TABLE generations ADD COLUMN neighborhood_data jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'geocoding_data'
  ) THEN
    ALTER TABLE generations ADD COLUMN geocoding_data jsonb;
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE staging_queue TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS staging_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES generations(id) ON DELETE SET NULL,
  photo_url text NOT NULL,
  room_type text NOT NULL,
  style text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  staged_url text,
  provider text CHECK (provider IN ('reimagine', 'virtualstagingai', 'fallback')),
  provider_job_id text,
  error_message text,
  processing_time_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================================
-- 4. CREATE staging_rate_limits TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS staging_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requests_last_hour integer NOT NULL DEFAULT 0,
  last_request_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts_today integer NOT NULL DEFAULT 0,
  is_suspended boolean NOT NULL DEFAULT false,
  suspension_until timestamptz
);

-- ============================================================================
-- 5. ENABLE RLS
-- ============================================================================

ALTER TABLE staging_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES - staging_queue
-- ============================================================================

CREATE POLICY "Users can view own staging queue entries"
  ON staging_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own staging requests"
  ON staging_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own staging queue entries"
  ON staging_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. RLS POLICIES - staging_rate_limits
-- ============================================================================

CREATE POLICY "Users can view own rate limit data"
  ON staging_rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rate limit data"
  ON staging_rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limit data"
  ON staging_rate_limits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 8. CREATE INDEXES
-- ============================================================================

-- Staging queue indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_staging_queue_user_id ON staging_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_staging_queue_status ON staging_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_staging_queue_created_at ON staging_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staging_queue_generation_id ON staging_queue(generation_id) WHERE generation_id IS NOT NULL;

-- Rate limit index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_staging_rate_limits_last_request ON staging_rate_limits(last_request_at);

-- Generations indexes for new columns
CREATE INDEX IF NOT EXISTS idx_generations_confidence_score ON generations(confidence_score) WHERE confidence_score IS NOT NULL;

-- User profiles indexes for Stripe integration
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);