/*
  # Optimize RLS Policies for Performance

  ## Overview
  Fixes performance issues in RLS policies by wrapping auth.uid() in SELECT statements.
  This prevents the function from being re-evaluated for each row, significantly improving query performance at scale.

  ## Changes
  - Drop existing RLS policies
  - Recreate policies with optimized (SELECT auth.uid()) pattern
  - Maintains same security posture with better performance

  ## Security
  No changes to security model - only performance optimization
*/

-- Drop existing policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Drop existing policies for generations
DROP POLICY IF EXISTS "Users can view own generations" ON generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON generations;
DROP POLICY IF EXISTS "Users can update own generations" ON generations;
DROP POLICY IF EXISTS "Users can delete own generations" ON generations;

-- Recreate optimized policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Recreate optimized policies for generations
CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own generations"
  ON generations FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own generations"
  ON generations FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own generations"
  ON generations FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);