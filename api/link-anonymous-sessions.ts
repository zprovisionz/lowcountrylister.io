import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import { logger } from './_lib/logger.js';

/**
 * Link anonymous generations to user account after sign-up
 * Called automatically when user authenticates
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require authentication
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get session_id from request body or cookie
    const { session_id } = req.body;
    const cookies = req.headers.cookie || '';
    const sessionMatch = cookies.match(/anon_session=([^;]+)/);
    const sessionId = session_id || (sessionMatch ? sessionMatch[1] : null);

    if (!sessionId) {
      // No session to link, return success (not an error)
      return res.status(200).json({
        success: true,
        linked_count: 0,
        message: 'No anonymous session found to link',
      });
    }

    const supabase = createServiceClient();

    // Find all anonymous generations for this session that aren't already linked
    const { data: anonymousGenerations, error: fetchError } = await supabase
      .from('anonymous_generations')
      .select('id')
      .eq('session_id', sessionId)
      .is('linked_user_id', null)
      .gte('expires_at', new Date().toISOString()); // Only link non-expired generations

    if (fetchError) {
      logger.error('Error fetching anonymous generations:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch anonymous generations' });
    }

    if (!anonymousGenerations || anonymousGenerations.length === 0) {
      return res.status(200).json({
        success: true,
        linked_count: 0,
        message: 'No anonymous generations found to link',
      });
    }

    // Link all anonymous generations to user account
    const { error: updateError } = await supabase
      .from('anonymous_generations')
      .update({ linked_user_id: user.id })
      .eq('session_id', sessionId)
      .is('linked_user_id', null);

    if (updateError) {
      logger.error('Error linking anonymous generations:', updateError);
      return res.status(500).json({ error: 'Failed to link anonymous generations' });
    }

    logger.info('Linked anonymous generations to user', {
      userId: user.id,
      sessionId: sessionId.substring(0, 8) + '...',
      count: anonymousGenerations.length,
    });

    return res.status(200).json({
      success: true,
      linked_count: anonymousGenerations.length,
      message: `Successfully linked ${anonymousGenerations.length} generation(s) to your account`,
    });
  } catch (error) {
    logger.error('Link anonymous sessions error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

