import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from '../_lib/supabase.js';
import { createServiceClient } from '../_lib/supabase.js';
import { logger } from '../_lib/logger.js';

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

    const supabase = createServiceClient();

    // Get user's bulk jobs (and team jobs if applicable)
    const { data: userJobs } = await supabase
      .from('bulk_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get team jobs
    const { data: teams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    const teamIds = teams?.map(t => t.team_id) || [];

    let teamJobs: any[] = [];
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('bulk_jobs')
        .select('*')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
        .limit(50);
      teamJobs = data || [];
    }

    // Combine and sort
    const allJobs = [...(userJobs || []), ...teamJobs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    return res.status(200).json({
      success: true,
      data: allJobs,
    });
  } catch (error) {
    logger.error('Bulk history error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

