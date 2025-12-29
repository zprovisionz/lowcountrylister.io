import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from '../_lib/supabase.js';
import { logger } from '../_lib/logger.js';

// This would be called by a Vercel Cron job or Supabase Edge Function
// Processes pending bulk jobs in batches

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = createServiceClient();

    // Get oldest pending job
    const { data: bulkJob } = await supabase
      .from('bulk_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!bulkJob) {
      return res.status(200).json({ message: 'No pending jobs' });
    }

    // Mark job as processing
    await supabase
      .from('bulk_jobs')
      .update({ status: 'processing' })
      .eq('id', bulkJob.id);

    // Get pending items (batch of 5)
    const { data: items } = await supabase
      .from('bulk_job_items')
      .select('*')
      .eq('bulk_job_id', bulkJob.id)
      .eq('status', 'pending')
      .order('row_number', { ascending: true })
      .limit(5);

    if (!items || items.length === 0) {
      // No more items to process - mark job as completed
      await supabase
        .from('bulk_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', bulkJob.id);

      return res.status(200).json({ message: 'Job completed' });
    }

    // Process items (call generate API for each)
    // In production, this would call the generate endpoint internally
    // For now, mark items as processing
    for (const item of items) {
      await supabase
        .from('bulk_job_items')
        .update({ status: 'processing' })
        .eq('id', item.id);

      // TODO: Actually call generation API here
      // This is a placeholder - would need to import and call generate logic
      // For now, mark as completed with placeholder
      await supabase
        .from('bulk_job_items')
        .update({
          status: 'completed',
          // generation_id would be set here
        })
        .eq('id', item.id);

      await supabase.rpc('increment', {
        table_name: 'bulk_jobs',
        row_id: bulkJob.id,
        column_name: 'processed_rows',
      }).catch(() => {
        supabase
          .from('bulk_jobs')
          .update({ processed_rows: supabase.raw('processed_rows + 1') })
          .eq('id', bulkJob.id);
      });
    }

    return res.status(200).json({
      message: `Processed ${items.length} items`,
      job_id: bulkJob.id,
    });
  } catch (error) {
    logger.error('Bulk process queue error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

