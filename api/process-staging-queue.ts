import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './_lib/supabase';
import { checkStagingStatus } from './_lib/staging-provider';

/**
 * Cron job endpoint to process pending staging queue entries
 * Call this endpoint periodically (e.g., every 30 seconds) to check and process staging jobs
 * 
 * Usage: Set up a Vercel Cron Job or external cron service to call:
 * GET /api/process-staging-queue?secret=<CRON_SECRET>
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
    // Fetch pending jobs (limit to 10 at a time to avoid overload)
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('staging_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching pending jobs:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch pending jobs' });
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending jobs to process',
        processed: 0,
      });
    }

    console.log(`Processing ${pendingJobs.length} pending staging jobs...`);

    // Process each pending job
    const results = await Promise.allSettled(
      pendingJobs.map(async (job) => {
        try {
          // Update status to processing
          await supabase
            .from('staging_queue')
            .update({ status: 'processing' })
            .eq('id', job.id);

          // Import staging provider
          const { requestStaging } = await import('./_lib/staging-provider');

          // Request staging from provider
          const stagingResponse = await requestStaging({
            image_url: job.photo_url,
            room_type: job.room_type,
            style: job.style,
          });

          if (!stagingResponse.success || !stagingResponse.job_id) {
            await supabase
              .from('staging_queue')
              .update({
                status: 'failed',
                error_message: stagingResponse.error || 'Staging request failed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            return { id: job.id, status: 'failed' };
          }

          // Update queue entry with provider info
          await supabase
            .from('staging_queue')
            .update({
              provider: stagingResponse.provider,
              provider_job_id: stagingResponse.job_id,
              status: 'processing',
            })
            .eq('id', job.id);

          return { id: job.id, status: 'processing', provider: stagingResponse.provider };
        } catch (error) {
          console.error(`Error processing job ${job.id}:`, error);
          await supabase
            .from('staging_queue')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          return { id: job.id, status: 'failed' };
        }
      })
    );

    // Check status of processing jobs
    const { data: processingJobs } = await supabase
      .from('staging_queue')
      .select('*')
      .eq('status', 'processing')
      .not('provider_job_id', 'is', null)
      .limit(20);

    if (processingJobs && processingJobs.length > 0) {
      await Promise.allSettled(
        processingJobs.map(async (job) => {
          try {
            if (!job.provider_job_id || !job.provider) return;

            const statusResponse = await checkStagingStatus(
              job.provider_job_id,
              job.provider as 'reimagine' | 'virtualstagingai' | 'fallback'
            );

            if (!statusResponse.success) {
              await supabase
                .from('staging_queue')
                .update({
                  status: 'failed',
                  error_message: statusResponse.error || 'Status check failed',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', job.id);
              return;
            }

            if (statusResponse.status === 'completed' && statusResponse.result_url) {
              const processingTime = Math.round(
                (new Date().getTime() - new Date(job.created_at).getTime()) / 1000
              );

              await supabase
                .from('staging_queue')
                .update({
                  status: 'completed',
                  staged_url: statusResponse.result_url,
                  processing_time_seconds: processingTime,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', job.id);

              // Update generation if linked
              if (job.generation_id) {
                const { data: generation } = await supabase
                  .from('generations')
                  .select('staged_images')
                  .eq('id', job.generation_id)
                  .single();

                const stagedImages = generation?.staged_images || [];
                stagedImages.push({
                  original_url: job.photo_url,
                  staged_url: statusResponse.result_url,
                  style: job.style,
                  room_type: job.room_type,
                  created_at: new Date().toISOString(),
                });

                await supabase
                  .from('generations')
                  .update({ staged_images: stagedImages })
                  .eq('id', job.generation_id);
              }
            }
          } catch (error) {
            console.error(`Error checking status for job ${job.id}:`, error);
          }
        })
      );
    }

    const processed = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return res.status(200).json({
      success: true,
      message: `Processed ${processed} jobs, ${failed} failed`,
      processed,
      failed,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

