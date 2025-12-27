import { createServiceClient } from './supabase';
import { SUBSCRIPTION_TIERS, UserProfile } from './types';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as UserProfile;
}

export async function checkAndResetQuota(profile: UserProfile): Promise<UserProfile> {
  const supabase = createServiceClient();
  const now = new Date();
  const lastReset = new Date(profile.last_reset_date);

  const daysSinceReset = Math.floor(
    (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceReset >= 30) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        generations_this_month: 0,
        staging_credits_used_this_month: 0,
        last_reset_date: now.toISOString(),
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (!error && data) {
      return data as UserProfile;
    }
  }

  return profile;
}

export function canGenerate(profile: UserProfile): {
  allowed: boolean;
  reason?: string;
} {
  const tier = SUBSCRIPTION_TIERS[profile.subscription_tier];

  if (!tier) {
    return { allowed: false, reason: 'Invalid subscription tier' };
  }

  if (tier.generations_per_month === -1) {
    return { allowed: true };
  }

  if (profile.generations_this_month >= tier.generations_per_month) {
    return {
      allowed: false,
      reason: `Monthly generation limit reached (${tier.generations_per_month}). Upgrade to generate more.`,
    };
  }

  return { allowed: true };
}

export function canStage(profile: UserProfile, requestedCredits: number = 1): {
  allowed: boolean;
  reason?: string;
  available_credits?: number;
} {
  const tier = SUBSCRIPTION_TIERS[profile.subscription_tier];

  if (!tier) {
    return { allowed: false, reason: 'Invalid subscription tier' };
  }

  // Pro+ has unlimited credits (-1)
  if (tier.staging_credits_per_month === -1) {
    return { allowed: true, available_credits: -1 }; // -1 means unlimited
  }

  const totalAvailable =
    tier.staging_credits_per_month -
    profile.staging_credits_used_this_month +
    profile.staging_credits_bonus;

  if (totalAvailable < requestedCredits) {
    return {
      allowed: false,
      reason: `Insufficient staging credits. You have ${totalAvailable} remaining.`,
      available_credits: totalAvailable,
    };
  }

  return { allowed: true, available_credits: totalAvailable };
}

export async function incrementGenerationCount(userId: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase.rpc('increment', {
    table_name: 'user_profiles',
    row_id: userId,
    column_name: 'generations_this_month',
  }).catch(() => {
    supabase
      .from('user_profiles')
      .update({
        generations_this_month: supabase.raw('generations_this_month + 1'),
      })
      .eq('id', userId);
  });
}

export async function incrementStagingCount(
  userId: string,
  credits: number = 1
): Promise<void> {
  const supabase = createServiceClient();

  const profile = await getUserProfile(userId);
  if (!profile) return;

  let creditsToDeduct = credits;
  let bonusUsed = 0;

  if (profile.staging_credits_bonus > 0) {
    bonusUsed = Math.min(profile.staging_credits_bonus, creditsToDeduct);
    creditsToDeduct -= bonusUsed;
  }

  await supabase
    .from('user_profiles')
    .update({
      staging_credits_used_this_month:
        profile.staging_credits_used_this_month + creditsToDeduct,
      staging_credits_bonus: profile.staging_credits_bonus - bonusUsed,
      total_stagings_generated: profile.total_stagings_generated + credits,
    })
    .eq('id', userId);
}

export async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = createServiceClient();

  const { data: rateLimit } = await supabase
    .from('staging_rate_limits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const now = new Date();

  if (!rateLimit) {
    await supabase.from('staging_rate_limits').insert({
      user_id: userId,
      requests_last_hour: 1,
      last_request_at: now.toISOString(),
      failed_attempts_today: 0,
      is_suspended: false,
    });
    return { allowed: true };
  }

  if (rateLimit.is_suspended && rateLimit.suspension_until) {
    const suspensionEnd = new Date(rateLimit.suspension_until);
    if (now < suspensionEnd) {
      return {
        allowed: false,
        reason: `Account temporarily suspended until ${suspensionEnd.toLocaleString()}`,
      };
    }
  }

  const lastRequest = new Date(rateLimit.last_request_at);
  const hoursSinceLastRequest =
    (now.getTime() - lastRequest.getTime()) / (1000 * 60 * 60);

  let requestsInLastHour = rateLimit.requests_last_hour;

  if (hoursSinceLastRequest >= 1) {
    requestsInLastHour = 0;
  }

  if (requestsInLastHour >= 5) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded. Maximum 5 staging requests per hour.',
    };
  }

  await supabase
    .from('staging_rate_limits')
    .update({
      requests_last_hour: requestsInLastHour + 1,
      last_request_at: now.toISOString(),
      is_suspended: false,
      suspension_until: null,
    })
    .eq('user_id', userId);

  return { allowed: true };
}
