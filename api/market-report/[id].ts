import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from '../../_lib/supabase.js';
import { createServiceClient } from '../../_lib/supabase.js';
import { logger } from '../../_lib/logger.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reportId = req.query.id as string;
    if (!reportId) {
      return res.status(400).json({ error: 'Report ID required' });
    }

    const supabase = createServiceClient();

    // Get report
    const { data: report, error: reportError } = await supabase
      .from('market_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Verify access
    if (report.user_id !== user.id) {
      if (report.team_id) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', report.team_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Market report fetch error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

