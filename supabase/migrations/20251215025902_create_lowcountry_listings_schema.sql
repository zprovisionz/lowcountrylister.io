/*
  # Lowcountry Listings AI Database Schema

  ## Overview
  Creates the core database structure for the Charleston real estate listing generator SaaS.
  Tracks user accounts, generation history, and freemium usage limits.

  ## New Tables
  
  ### `user_profiles`
  Extends Supabase auth.users with app-specific data:
  - `id` (uuid, FK to auth.users) - User identifier
  - `email` (text) - User email for display
  - `plan` (text) - Subscription tier: 'free', 'starter', 'pro'
  - `generations_this_month` (integer) - Count of generations in current billing period
  - `billing_period_start` (timestamptz) - Start of current billing month
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `generations`
  Stores all listing description generations:
  - `id` (uuid, PK) - Generation identifier
  - `user_id` (uuid, FK to auth.users) - Owner of generation
  - `address` (text) - Property address
  - `bedrooms` (integer) - Number of bedrooms
  - `bathrooms` (numeric) - Number of bathrooms (allows .5)
  - `square_feet` (integer) - Property square footage
  - `property_type` (text) - Type of property
  - `amenities` (jsonb) - Selected amenities array
  - `photo_urls` (jsonb) - Array of uploaded photo URLs
  - `include_airbnb` (boolean) - Generate Airbnb variant
  - `include_social` (boolean) - Generate social media captions
  - `mls_description` (text) - Generated MLS description
  - `airbnb_description` (text) - Generated Airbnb description (nullable)
  - `social_captions` (jsonb) - Array of social media captions (nullable)
  - `confidence_level` (text) - 'high' or 'medium'
  - `created_at` (timestamptz) - Generation timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only read/write their own profile
  - Users can only read/write their own generations
  - Authenticated users required for all operations
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  generations_this_month integer NOT NULL DEFAULT 0,
  billing_period_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create generations table
CREATE TABLE IF NOT EXISTS generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  bedrooms integer,
  bathrooms numeric(3,1),
  square_feet integer,
  property_type text NOT NULL,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_airbnb boolean NOT NULL DEFAULT false,
  include_social boolean NOT NULL DEFAULT false,
  mls_description text,
  airbnb_description text,
  social_captions jsonb,
  confidence_level text DEFAULT 'medium' CHECK (confidence_level IN ('high', 'medium')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for generations
CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON generations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations"
  ON generations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);