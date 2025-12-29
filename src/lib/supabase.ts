import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}\n\n` +
    `Please create a .env.local file in the project root with:\n` +
    `VITE_SUPABASE_URL=your_supabase_project_url\n` +
    `VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n` +
    `Get these values from: https://supabase.com/dashboard → Your Project → Settings → API`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  email: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'pro_plus' | 'team';
  generations_this_month: number;
  staging_credits_used_this_month: number;
  staging_credits_bonus: number;
  total_stagings_generated: number;
  billing_period_start: string;
  last_reset_date: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_team_id?: string;
  default_branding?: {
    logo_url?: string;
    primary_color?: string;
    tagline?: string;
  };
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
  team_id?: string;
  tracking_id?: string;
  bulk_job_id?: string;
  is_shared?: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  branding: {
    logo_url?: string;
    primary_color?: string;
    tagline?: string;
  };
  subscription_tier: 'team';
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'agent';
  invited_by?: string;
  joined_at: string;
}

export interface BulkJob {
  id: string;
  user_id: string;
  team_id?: string;
  file_name: string;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results_url?: string;
  created_at: string;
  completed_at?: string;
}

export interface BulkJobItem {
  id: string;
  bulk_job_id: string;
  row_number: number;
  input_data: {
    address: string;
    beds?: number;
    baths?: number;
    sqft?: number;
    property_type?: string;
    amenities?: string[];
  };
  generation_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface ComparableListing {
  id: string;
  address: string;
  zip_code?: string;
  neighborhood?: string;
  property_type?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  list_price?: number;
  sold_price?: number;
  days_on_market?: number;
  sold_date?: string;
  data_source: 'manual' | 'mls_api' | 'public_records';
  created_by?: string;
  created_at: string;
}

export interface MarketReport {
  id: string;
  user_id: string;
  team_id?: string;
  neighborhood?: string;
  zip_code?: string;
  report_type: 'neighborhood' | 'zip' | 'custom_area';
  report_data: {
    median_price?: number;
    price_per_sqft?: number;
    days_on_market_avg?: number;
    inventory_levels?: number;
    recent_sales?: ComparableListing[];
    market_narrative?: string;
    comparable_properties?: ComparableListing[];
    trends?: {
      price_trend?: 'up' | 'down' | 'stable';
      inventory_trend?: 'up' | 'down' | 'stable';
      days_on_market_trend?: 'up' | 'down' | 'stable';
    };
  };
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  generation_id: string;
  event_type: 'view' | 'copy' | 'external_view' | 'click' | 'regenerate';
  source: 'app' | 'mls' | 'zillow' | 'email' | 'realtor' | 'other';
  metadata?: {
    referrer?: string;
    user_agent?: string;
    ip_address?: string;
    location?: string;
    [key: string]: any;
  };
  tracking_id?: string;
  created_at: string;
}
