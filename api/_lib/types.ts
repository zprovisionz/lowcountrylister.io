export interface UserProfile {
  id: string;
  email: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'pro_plus' | 'team';
  generations_this_month: number;
  staging_credits_used_this_month: number;
  staging_credits_bonus: number;
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
  neighborhood_data?: NeighborhoodData;
  geocoding_data?: GeocodingData;
  created_at: string;
}

export interface StagedImage {
  original_url: string;
  staged_url: string;
  style: string;
  room_type: string;
  created_at: string;
}

export interface StagingQueueEntry {
  id: string;
  user_id: string;
  generation_id?: string;
  photo_url: string;
  room_type: string;
  style: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  staged_url?: string;
  provider?: 'reimagine' | 'virtualstagingai' | 'fallback';
  provider_job_id?: string;
  error_message?: string;
  processing_time_seconds?: number;
  created_at: string;
  completed_at?: string;
}

export interface NeighborhoodData {
  name: string;
  description: string;
  vibe: string;
  amenities: string[];
  keywords: string[];
}

export interface GeocodingData {
  latitude: number;
  longitude: number;
  formatted_address: string;
  distances_to_landmarks: {
    name: string;
    distance_miles: number;
    drive_time_minutes: number;
  }[];
}

export interface SubscriptionTierLimits {
  name: string;
  generations_per_month: number;
  staging_credits_per_month: number;
  price_monthly: number;
  price_annual: number;
  can_purchase_staging_packs: boolean;
  bulk_job_max_rows: number;
  bulk_jobs_per_day: number;
  has_bulk_generation: boolean;
  has_analytics: 'basic' | 'full' | 'none';
  has_team_features: boolean;
  has_market_reports: boolean;
  overage_rate_generations?: number; // Price per generation over limit
  overage_rate_staging?: number; // Price per staging credit over limit
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierLimits> = {
  free: {
    name: 'Free',
    generations_per_month: 10,
    staging_credits_per_month: 0,
    price_monthly: 0,
    price_annual: 0,
    can_purchase_staging_packs: false,
    bulk_job_max_rows: 0,
    bulk_jobs_per_day: 0,
    has_bulk_generation: false,
    has_analytics: 'basic',
    has_team_features: false,
    has_market_reports: false,
  },
  starter: {
    name: 'Starter',
    generations_per_month: 100,
    staging_credits_per_month: 10,
    price_monthly: 15,
    price_annual: 144,
    can_purchase_staging_packs: false,
    bulk_job_max_rows: 10,
    bulk_jobs_per_day: 2,
    has_bulk_generation: true,
    has_analytics: 'basic',
    has_team_features: false,
    has_market_reports: false,
    overage_rate_generations: 0.75,
    overage_rate_staging: 0.75,
  },
  pro: {
    name: 'Pro',
    generations_per_month: -1, // Unlimited
    staging_credits_per_month: 30,
    price_monthly: 29,
    price_annual: 278,
    can_purchase_staging_packs: false,
    bulk_job_max_rows: 50,
    bulk_jobs_per_day: 10,
    has_bulk_generation: true,
    has_analytics: 'full',
    has_team_features: false,
    has_market_reports: true,
    overage_rate_staging: 5, // $5 per 10 credits
  },
  pro_plus: {
    name: 'Pro+',
    generations_per_month: -1, // Unlimited
    staging_credits_per_month: 100,
    price_monthly: 49,
    price_annual: 470,
    can_purchase_staging_packs: true,
    bulk_job_max_rows: 200,
    bulk_jobs_per_day: -1, // Unlimited
    has_bulk_generation: true,
    has_analytics: 'full',
    has_team_features: true,
    has_market_reports: true,
    overage_rate_staging: 5, // $5 per 10 credits
  },
  team: {
    name: 'Team',
    generations_per_month: -1, // Unlimited shared
    staging_credits_per_month: 150,
    price_monthly: 99,
    price_annual: 950,
    can_purchase_staging_packs: true,
    bulk_job_max_rows: 200,
    bulk_jobs_per_day: -1, // Unlimited
    has_bulk_generation: true,
    has_analytics: 'full',
    has_team_features: true,
    has_market_reports: true,
    overage_rate_staging: 5, // $5 per 10 credits
  },
};

export interface APIError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
