import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  email: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'pro_plus';
  generations_this_month: number;
  staging_credits_used_this_month: number;
  staging_credits_bonus: number;
  total_stagings_generated: number;
  billing_period_start: string;
  last_reset_date: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StagedImage {
  original_url: string;
  staged_url: string;
  style: string;
  room_type: string;
  created_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  property_type: string;
  amenities: string[];
  photo_urls: string[];
  include_airbnb: boolean;
  include_social: boolean;
  mls_description?: string;
  airbnb_description?: string;
  social_captions?: string[];
  confidence_level?: 'high' | 'medium';
  confidence_score?: number;
  staged_images?: StagedImage[];
  neighborhood_data?: any;
  geocoding_data?: any;
  created_at: string;
}
