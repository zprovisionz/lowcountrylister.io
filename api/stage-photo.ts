import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken, createServiceClient } from './_lib/supabase';
import {
  getUserProfile,
  checkAndResetQuota,
  canStage,
  checkRateLimit,
  incrementStagingCount,
} from './_lib/quota';
import { StagePhotoSchema } from './_lib/validation';
import { analyzePhotoForStaging } from './_lib/vision';
import { requestStaging } from './_lib/staging-provider';

/**
 * Background processing function for staging jobs
 * This processes pending staging queue entries asynchronously
 */
async function processStagingJob(queueId: string): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Fetch queue entry
    const { data: queueEntry, error: fetchError } = await supabase
      .from('staging_queue')
      .select('*')
      .eq('id', queueId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError || !queueEntry) {
      console.error(`Queue entry ${queueId} not found or already processed`);
      return;
    }

    // Update status to processing
    await supabase
      .from('staging_queue')
      .update({ status: 'processing' })
      .eq('id', queueId);

    console.log(`Processing staging job ${queueId}...`);

    // Request staging from provider
    const stagingResponse = await requestStaging({
      image_url: queueEntry.photo_url,
      room_type: queueEntry.room_type,
      style: queueEntry.style,
    });

    if (!stagingResponse.success || !stagingResponse.job_id) {
      await supabase
        .from('staging_queue')
        .update({
          status: 'failed',
          error_message: stagingResponse.error || 'Staging request failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);
      return;
    }

    // Update queue entry with provider info
    await supabase
      .from('staging_queue')
      .update({
        provider: stagingResponse.provider,
        provider_job_id: stagingResponse.job_id,
        status: 'processing',
      })
      .eq('id', queueId);

    console.log(`Staging job ${queueId} submitted to provider ${stagingResponse.provider}`);
  } catch (error) {
    console.error(`Error processing staging job ${queueId}:`, error);
    await supabase
      .from('staging_queue')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', queueId);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validationResult = StagePhotoSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    let profile = await getUserProfile(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    profile = await checkAndResetQuota(profile);

    if (profile.subscription_tier === 'free') {
      return res.status(403).json({
        error: 'Virtual staging requires a paid subscription',
        code: 'UPGRADE_REQUIRED',
      });
    }

    const rateLimitCheck = await checkRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: rateLimitCheck.reason,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    const stagingCheck = canStage(profile, 1);
    if (!stagingCheck.allowed) {
      return res.status(403).json({
        error: stagingCheck.reason,
        code: 'STAGING_QUOTA_EXCEEDED',
        available_credits: stagingCheck.available_credits,
      });
    }

    // Photo should already be uploaded to Supabase storage by the client
    // We'll use the provided photo_url
    const photoUrl = data.photo_url;

    console.log('Analyzing photo suitability...');
    const analysis = await analyzePhotoForStaging(photoUrl);

    if (!analysis.is_suitable || analysis.confidence < 60) {
      return res.status(400).json({
        error: analysis.reason || 'Photo not suitable for staging',
        code: 'UNSUITABLE_PHOTO',
        details: {
          confidence: analysis.confidence,
          suggested_room_type: analysis.room_type,
        },
      });
    }

    const supabase = createServiceClient();

    // Create queue entry first (status: pending)
    const { data: queueEntry, error: insertError } = await supabase
      .from('staging_queue')
      .insert({
        user_id: user.id,
        generation_id: data.generation_id || null,
        photo_url: photoUrl,
        room_type: data.room_type,
        style: data.style,
        status: 'pending', // Will be processed by background job
        provider: null, // Will be set by background processor
        provider_job_id: null,
      })
      .select()
      .single();

    if (insertError || !queueEntry) {
      console.error('Queue insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create staging queue entry' });
    }

    // Increment staging count immediately (deduct credit)
    await incrementStagingCount(user.id, 1);

    // Start background processing (non-blocking)
    // Process staging asynchronously
    processStagingJob(queueEntry.id).catch((error) => {
      console.error(`Background processing error for queue ${queueEntry.id}:`, error);
    });

    return res.status(200).json({
      success: true,
      data: {
        queue_id: queueEntry.id,
        status: 'pending',
        estimated_time_seconds: 90,
      },
    });
  } catch (error) {
    console.error('Staging error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
