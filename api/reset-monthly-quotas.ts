import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './_lib/supabase';

/**
 * Cron job endpoint to reset monthly quotas for all users
 * Should run on the 1st of each month
 * 
 * Usage: Set up a Vercel Cron Job or external cron service to call:
 * GET /api/reset-monthly-quotas?secret=<CRON_SECRET>
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify cron secret for security
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.query.secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createServiceClient();

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Find all users whose last_reset_date is more than 30 days ago
    const { data: profiles, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, last_reset_date')
      .lt('last_reset_date', thirtyDaysAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch profiles' });
    }

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No profiles need quota reset',
        reset_count: 0,
      });
    }

    console.log(`Resetting quotas for ${profiles.length} users...`);

    // Reset quotas for all eligible users
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        generations_this_month: 0,
        staging_credits_used_this_month: 0,
        last_reset_date: now.toISOString(),
      })
      .lt('last_reset_date', thirtyDaysAgo.toISOString());

    if (updateError) {
      console.error('Error resetting quotas:', updateError);
      return res.status(500).json({ error: 'Failed to reset quotas' });
    }

    console.log(`Successfully reset quotas for ${profiles.length} users`);

    return res.status(200).json({
      success: true,
      message: `Reset quotas for ${profiles.length} users`,
      reset_count: profiles.length,
    });
  } catch (error) {
    console.error('Monthly reset error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

