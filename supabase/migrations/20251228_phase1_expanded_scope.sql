/*
  # Phase 1 Expanded Scope - Database Schema

  ## Overview
  Adds support for team accounts, bulk CSV generation, market reports/comps, and analytics tracking.

  ## New Tables
  - teams: Team/brokerage accounts
  - team_members: Team membership with role-based permissions
  - bulk_jobs: CSV bulk generation tracking
  - bulk_job_items: Individual rows in bulk jobs
  - comparable_listings: Comps/market data cache
  - market_reports: Generated market reports
  - analytics_events: Performance tracking events

  ## Schema Updates
  - user_profiles: Add team support
  - generations: Add team, tracking, and bulk job support
*/

-- ============================================================================
-- 1. CREATE teams TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branding jsonb DEFAULT '{}'::jsonb,
  subscription_tier text NOT NULL DEFAULT 'team' CHECK (subscription_tier IN ('team')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. CREATE team_members TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- ============================================================================
-- 3. CREATE bulk_jobs TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  total_rows integer NOT NULL,
  processed_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  results_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================================
-- 4. CREATE bulk_job_items TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bulk_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_job_id uuid NOT NULL REFERENCES bulk_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  input_data jsonb NOT NULL,
  generation_id uuid REFERENCES generations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. CREATE comparable_listings TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS comparable_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  zip_code text,
  neighborhood text,
  property_type text,
  beds integer,
  baths numeric(3,1),
  sqft integer,
  list_price numeric(12,2),
  sold_price numeric(12,2),
  days_on_market integer,
  sold_date date,
  data_source text NOT NULL DEFAULT 'manual' CHECK (data_source IN ('manual', 'mls_api', 'public_records')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 6. CREATE market_reports TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  neighborhood text,
  zip_code text,
  report_type text NOT NULL CHECK (report_type IN ('neighborhood', 'zip', 'custom_area')),
  report_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. CREATE analytics_events TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'copy', 'external_view', 'click', 'regenerate')),
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'mls', 'zillow', 'email', 'realtor', 'other')),
  metadata jsonb DEFAULT '{}'::jsonb,
  tracking_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. UPDATE user_profiles TABLE
-- ============================================================================

DO $$
BEGIN
  -- Add team support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_team_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'default_branding'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN default_branding jsonb;
  END IF;
END $$;

-- Update subscription_tier constraint to include 'team' tier
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;
  
  -- Add new constraint with 'team' tier
  ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_subscription_tier_check 
    CHECK (subscription_tier IN ('free', 'starter', 'pro', 'pro_plus', 'team'));
END $$;

-- ============================================================================
-- 9. UPDATE generations TABLE
-- ============================================================================

DO $$
BEGIN
  -- Add team support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE generations ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
  END IF;

  -- Add tracking support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'tracking_id'
  ) THEN
    ALTER TABLE generations ADD COLUMN tracking_id text UNIQUE;
  END IF;

  -- Add bulk job support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'bulk_job_id'
  ) THEN
    ALTER TABLE generations ADD COLUMN bulk_job_id uuid REFERENCES bulk_jobs(id) ON DELETE SET NULL;
  END IF;

  -- Add shared flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'is_shared'
  ) THEN
    ALTER TABLE generations ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- 10. ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparable_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. RLS POLICIES - teams
-- ============================================================================

CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can update teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- 12. RLS POLICIES - team_members
-- ============================================================================

CREATE POLICY "Users can view members of their teams"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can add members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update member roles"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

CREATE POLICY "Admins can remove members"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

-- ============================================================================
-- 13. RLS POLICIES - bulk_jobs
-- ============================================================================

CREATE POLICY "Users can view own bulk jobs"
  ON bulk_jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view team bulk jobs"
  ON bulk_jobs FOR SELECT
  TO authenticated
  USING (
    team_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = bulk_jobs.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bulk jobs"
  ON bulk_jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 14. RLS POLICIES - bulk_job_items
-- ============================================================================

CREATE POLICY "Users can view items from own bulk jobs"
  ON bulk_job_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bulk_jobs
      WHERE bulk_jobs.id = bulk_job_items.bulk_job_id
      AND bulk_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view items from team bulk jobs"
  ON bulk_job_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bulk_jobs
      WHERE bulk_jobs.id = bulk_job_items.bulk_job_id
      AND bulk_jobs.team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = bulk_jobs.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 15. RLS POLICIES - comparable_listings
-- ============================================================================

CREATE POLICY "Anyone authenticated can view comps"
  ON comparable_listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add comps"
  ON comparable_listings FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ============================================================================
-- 16. RLS POLICIES - market_reports
-- ============================================================================

CREATE POLICY "Users can view own reports"
  ON market_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view team reports"
  ON market_reports FOR SELECT
  TO authenticated
  USING (
    team_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = market_reports.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create reports"
  ON market_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 17. RLS POLICIES - analytics_events
-- ============================================================================

CREATE POLICY "Users can view events for own generations"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM generations
      WHERE generations.id = analytics_events.generation_id
      AND generations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view events for team generations"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM generations
      WHERE generations.id = analytics_events.generation_id
      AND generations.team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = generations.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can insert events"
  ON analytics_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- 18. UPDATE generations RLS POLICIES for team access
-- ============================================================================

-- Drop existing policy and recreate with team support
DROP POLICY IF EXISTS "Users can view own generations" ON generations;

CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Team members can view shared generations"
  ON generations FOR SELECT
  TO authenticated
  USING (
    is_shared = true AND
    team_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = generations.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 19. CREATE INDEXES
-- ============================================================================

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(team_id, role);

-- Bulk jobs indexes
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_user_id ON bulk_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_team_id ON bulk_jobs(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created_at ON bulk_jobs(created_at DESC);

-- Bulk job items indexes
CREATE INDEX IF NOT EXISTS idx_bulk_job_items_bulk_job_id ON bulk_job_items(bulk_job_id);
CREATE INDEX IF NOT EXISTS idx_bulk_job_items_status ON bulk_job_items(status) WHERE status IN ('pending', 'processing');

-- Comparable listings indexes
CREATE INDEX IF NOT EXISTS idx_comparable_listings_zip_code ON comparable_listings(zip_code);
CREATE INDEX IF NOT EXISTS idx_comparable_listings_neighborhood ON comparable_listings(neighborhood);
CREATE INDEX IF NOT EXISTS idx_comparable_listings_property_type ON comparable_listings(property_type);
CREATE INDEX IF NOT EXISTS idx_comparable_listings_sold_date ON comparable_listings(sold_date DESC);

-- Market reports indexes
CREATE INDEX IF NOT EXISTS idx_market_reports_user_id ON market_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_market_reports_team_id ON market_reports(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_reports_neighborhood ON market_reports(neighborhood);
CREATE INDEX IF NOT EXISTS idx_market_reports_created_at ON market_reports(created_at DESC);

-- Analytics events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_generation_id ON analytics_events(generation_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tracking_id ON analytics_events(tracking_id) WHERE tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);

-- ============================================================================
-- 8. CREATE mls_connections TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mls_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('reso_web_api', 'bright_mls', 'matrix', 'other')),
  mls_name text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  api_base_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_or_team_required CHECK (
    (user_id IS NOT NULL AND team_id IS NULL) OR
    (user_id IS NULL AND team_id IS NOT NULL)
  )
);

-- MLS Connections indexes
CREATE INDEX IF NOT EXISTS idx_mls_connections_user_id ON mls_connections(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mls_connections_team_id ON mls_connections(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mls_connections_provider ON mls_connections(provider);
CREATE INDEX IF NOT EXISTS idx_mls_connections_is_active ON mls_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_analytics_events_source ON analytics_events(source);

-- Generations indexes for new columns
CREATE INDEX IF NOT EXISTS idx_generations_team_id ON generations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generations_tracking_id ON generations(tracking_id) WHERE tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generations_bulk_job_id ON generations(bulk_job_id) WHERE bulk_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generations_is_shared ON generations(team_id, is_shared) WHERE is_shared = true;

-- User profiles indexes for team
CREATE INDEX IF NOT EXISTS idx_user_profiles_current_team_id ON user_profiles(current_team_id) WHERE current_team_id IS NOT NULL;

-- ============================================================================
-- 20. CREATE FUNCTIONS
-- ============================================================================

-- Function to generate unique tracking ID
CREATE OR REPLACE FUNCTION generate_tracking_id()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'trk_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
$$;

-- Function to create team slug from name
CREATE OR REPLACE FUNCTION generate_team_slug(team_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(team_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM teams WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

COMMENT ON TABLE teams IS 'Team/brokerage accounts with shared access and branding';
COMMENT ON TABLE team_members IS 'Team membership with role-based permissions';
COMMENT ON TABLE bulk_jobs IS 'CSV bulk generation job tracking';
COMMENT ON TABLE bulk_job_items IS 'Individual rows processed in bulk jobs';
COMMENT ON TABLE comparable_listings IS 'Market comparables data cache';
COMMENT ON TABLE market_reports IS 'Generated market analysis reports';
COMMENT ON TABLE analytics_events IS 'Performance tracking events for generations';

