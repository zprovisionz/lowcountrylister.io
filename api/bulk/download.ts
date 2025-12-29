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

    if (bulkJob.status !== 'completed') {
      return res.status(400).json({ error: 'Job not completed yet' });
    }

    // Get all job items with generations
    const { data: items, error: itemsError } = await supabase
      .from('bulk_job_items')
      .select(`
        *,
        generation:generation_id (
          address,
          mls_description,
          confidence_level,
          neighborhood_data
        )
      `)
      .eq('bulk_job_id', jobId)
      .order('row_number', { ascending: true });

    if (itemsError) {
      logger.error('Bulk download items error:', itemsError);
      return res.status(500).json({ error: 'Failed to fetch job items' });
    }

    // Generate CSV
    const csvRows = [
      'address,mls_description,confidence,neighborhood,status,error',
    ];

    items?.forEach(item => {
      const gen = item.generation as any;
      const address = item.input_data.address || '';
      const mls = gen?.mls_description?.replace(/"/g, '""') || '';
      const confidence = gen?.confidence_level || 'medium';
      const neighborhood = gen?.neighborhood_data?.name || '';
      const status = item.status === 'completed' ? 'success' : item.status;
      const error = item.error_message?.replace(/"/g, '""') || '';

      csvRows.push(
        `"${address}","${mls}","${confidence}","${neighborhood}","${status}","${error}"`
      );
    });

    const csvContent = csvRows.join('\n');

    // Return CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bulk_results_${jobId}.csv"`);
    return res.send(csvContent);
  } catch (error) {
    logger.error('Bulk download error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

