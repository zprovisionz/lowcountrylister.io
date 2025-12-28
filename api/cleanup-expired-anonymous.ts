import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './_lib/supabase.js';
import { logger } from './_lib/logger.js';

/**
 * Cleanup expired anonymous generations (older than 24 hours)
 * Runs via Vercel cron job every 6 hours
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify this is a cron request (optional security check)
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
  
  if (cronSecret && providedSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = createServiceClient();

    // Call the cleanup function from the database
    const { data, error } = await supabase.rpc('cleanup_expired_anonymous_generations');

    if (error) {
      logger.error('Cleanup error:', error);
      return res.status(500).json({
        error: 'Failed to cleanup expired generations',
        details: error.message,
      });
    }

    const deletedCount = data || 0;

    logger.info(`Cleaned up ${deletedCount} expired anonymous generations`);

    return res.status(200).json({
      success: true,
      deleted_count: deletedCount,
      message: `Successfully cleaned up ${deletedCount} expired anonymous generation(s)`,
    });
  } catch (error) {
    logger.error('Cleanup exception:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

