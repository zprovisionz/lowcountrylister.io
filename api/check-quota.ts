import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { getUserProfile, checkAndResetQuota } from './_lib/quota.js';

/**
 * Endpoint to check and reset quota if needed
 * Called by frontend to ensure quota is up-to-date
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let profile = await getUserProfile(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Check and reset quota if needed
    profile = await checkAndResetQuota(profile);

    return res.status(200).json({
      success: true,
      profile: {
        subscription_tier: profile.subscription_tier,
        generations_this_month: profile.generations_this_month,
        staging_credits_used_this_month: profile.staging_credits_used_this_month,
        last_reset_date: profile.last_reset_date,
      },
    });
  } catch (error) {
    console.error('Quota check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

