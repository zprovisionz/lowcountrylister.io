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

    const jobId = req.query.id as string;
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID required' });
    }

    const supabase = createServiceClient();

    // Get bulk job
    const { data: bulkJob, error: jobError } = await supabase
      .from('bulk_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !bulkJob) {
      return res.status(404).json({ error: 'Bulk job not found' });
    }

    // Verify access
    if (bulkJob.user_id !== user.id) {
      // Check team access
      if (bulkJob.team_id) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', bulkJob.team_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get item status breakdown
    const { data: items } = await supabase
      .from('bulk_job_items')
      .select('status')
      .eq('bulk_job_id', jobId);

    const statusCounts = {
      pending: items?.filter(i => i.status === 'pending').length || 0,
      processing: items?.filter(i => i.status === 'processing').length || 0,
      completed: items?.filter(i => i.status === 'completed').length || 0,
      failed: items?.filter(i => i.status === 'failed').length || 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        ...bulkJob,
        status_breakdown: statusCounts,
        progress_percent: bulkJob.total_rows > 0
          ? Math.round(((bulkJob.processed_rows + bulkJob.failed_rows) / bulkJob.total_rows) * 100)
          : 0,
      },
    });
  } catch (error) {
    logger.error('Bulk status error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

