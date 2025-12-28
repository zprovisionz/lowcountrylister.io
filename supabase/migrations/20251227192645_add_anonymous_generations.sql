/*
  # Anonymous Generations Table

  ## Overview
  Stores anonymous (non-authenticated) listing generations with session tracking,
  device fingerprinting, and automatic expiration after 24 hours.

  ## New Table
  
  ### `anonymous_generations`
  - `id` (uuid, PK) - Generation identifier
  - `session_id` (text) - Anonymous session identifier (from cookie)
  - `ip_address` (text) - Hashed IP address for privacy
  - `device_fingerprint` (text) - Hashed device signature
  - `generation_count` (integer) - Track usage per session
  - `address` (text) - Property address
  - `mls_description` (text) - Full MLS description
  - `preview_snippet` (text) - First 50 words preview
  - `geocoding_data` (jsonb) - Geocoding results
  - `neighborhood_data` (jsonb) - Neighborhood data
  - `created_at` (timestamptz) - Generation timestamp
  - `expires_at` (timestamptz) - Expiration (24 hours from creation)
  - `linked_user_id` (uuid, nullable) - Linked to user after sign-up

  ## Indexes
  - Index on `session_id` for fast lookups
  - Index on `ip_address` and `device_fingerprint` for rate limiting
  - Index on `expires_at` for cleanup operations
  - Index on `linked_user_id` for user linking queries

  ## Cleanup
  - Function to delete expired records (older than 24 hours)
  - Can be called via cron job or scheduled task
*/

-- Create anonymous_generations table
CREATE TABLE IF NOT EXISTS anonymous_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  ip_address text NOT NULL,
  device_fingerprint text NOT NULL,
  generation_count integer NOT NULL DEFAULT 1,
  address text NOT NULL,
  mls_description text NOT NULL,
  preview_snippet text NOT NULL,
  geocoding_data jsonb,
  neighborhood_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_anonymous_generations_session_id ON anonymous_generations(session_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_generations_ip_fingerprint ON anonymous_generations(ip_address, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_anonymous_generations_expires_at ON anonymous_generations(expires_at);
CREATE INDEX IF NOT EXISTS idx_anonymous_generations_linked_user_id ON anonymous_generations(linked_user_id);

-- Create function to clean up expired records
CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_generations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM anonymous_generations
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create function to get generation count for IP+device combo (last 24 hours)
CREATE OR REPLACE FUNCTION get_anonymous_generation_count(
  p_ip_address text,
  p_device_fingerprint text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM anonymous_generations
  WHERE ip_address = p_ip_address
    AND device_fingerprint = p_device_fingerprint
    AND created_at > (now() - interval '24 hours');
  
  RETURN count_result;
END;
$$;

-- Add comment
COMMENT ON TABLE anonymous_generations IS 'Stores anonymous listing generations with 24-hour expiration';
COMMENT ON FUNCTION cleanup_expired_anonymous_generations IS 'Cleans up expired anonymous generations (older than 24 hours)';
COMMENT ON FUNCTION get_anonymous_generation_count IS 'Returns count of generations for IP+device combo in last 24 hours';

