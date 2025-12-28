import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken, createServiceClient } from './_lib/supabase.js';
import { checkStagingStatus } from './_lib/staging-provider.js';

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

    const queueId = req.query.queue_id as string;

    if (!queueId) {
      return res.status(400).json({ error: 'queue_id parameter required' });
    }

    const supabase = createServiceClient();

    const { data: queueEntry, error: fetchError } = await supabase
      .from('staging_queue')
      .select('*')
      .eq('id', queueId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !queueEntry) {
      return res.status(404).json({ error: 'Staging queue entry not found' });
    }

    if (queueEntry.status === 'completed') {
      return res.status(200).json({
        success: true,
        data: {
          status: 'completed',
          staged_url: queueEntry.staged_url,
          processing_time_seconds: queueEntry.processing_time_seconds,
        },
      });
    }

    if (queueEntry.status === 'failed') {
      return res.status(200).json({
        success: false,
        data: {
          status: 'failed',
          error_message: queueEntry.error_message,
        },
      });
    }

    if (!queueEntry.provider_job_id || !queueEntry.provider) {
      return res.status(200).json({
        success: true,
        data: {
          status: queueEntry.status,
        },
      });
    }

    console.log('Checking status with provider...');
    const providerStatus = await checkStagingStatus(
      queueEntry.provider_job_id,
      queueEntry.provider as 'reimagine' | 'virtualstagingai' | 'fallback'
    );

    if (!providerStatus.success) {
      await supabase
        .from('staging_queue')
        .update({
          status: 'failed',
          error_message: providerStatus.error || 'Provider status check failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      return res.status(200).json({
        success: false,
        data: {
          status: 'failed',
          error_message: providerStatus.error,
        },
      });
    }

    if (providerStatus.status === 'completed' && providerStatus.result_url) {
      const processingTime = Math.round(
        (new Date().getTime() - new Date(queueEntry.created_at).getTime()) / 1000
      );

      await supabase
        .from('staging_queue')
        .update({
          status: 'completed',
          staged_url: providerStatus.result_url,
          processing_time_seconds: processingTime,
          completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      if (queueEntry.generation_id) {
        const { data: generation } = await supabase
          .from('generations')
          .select('staged_images')
          .eq('id', queueEntry.generation_id)
          .single();

        const stagedImages = generation?.staged_images || [];
        stagedImages.push({
          original_url: queueEntry.photo_url,
          staged_url: providerStatus.result_url,
          style: queueEntry.style,
          room_type: queueEntry.room_type,
          created_at: new Date().toISOString(),
        });

        await supabase
          .from('generations')
          .update({ staged_images: stagedImages })
          .eq('id', queueEntry.generation_id);
      }

      return res.status(200).json({
        success: true,
        data: {
          status: 'completed',
          staged_url: providerStatus.result_url,
          processing_time_seconds: processingTime,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: providerStatus.status || 'processing',
      },
    });
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
