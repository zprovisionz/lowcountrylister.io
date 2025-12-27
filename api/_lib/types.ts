export interface UserProfile {
  id: string;
  email: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'pro_plus';
  generations_this_month: number;
  staging_credits_used_this_month: number;
  staging_credits_bonus: number;
  billing_period_start: string;
  last_reset_date: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
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
  can_purchase_staging_packs: boolean;
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierLimits> = {
  free: {
    name: 'Free',
    generations_per_month: 3,
    staging_credits_per_month: 0,
    price_monthly: 0,
    can_purchase_staging_packs: false,
  },
  starter: {
    name: 'Starter',
    generations_per_month: 50,
    staging_credits_per_month: 3,
    price_monthly: 10,
    can_purchase_staging_packs: false,
  },
  pro: {
    name: 'Pro',
    generations_per_month: -1,
    staging_credits_per_month: 10, // Updated: Pro gets 10/mo
    price_monthly: 19,
    can_purchase_staging_packs: false,
  },
  pro_plus: {
    name: 'Pro+',
    generations_per_month: -1,
    staging_credits_per_month: -1, // Updated: Pro+ unlimited
    price_monthly: 29,
    can_purchase_staging_packs: true,
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
