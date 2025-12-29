import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from '../_lib/supabase.js';
import { createServiceClient } from '../_lib/supabase.js';
import { getUserProfile, canBulkGenerate, canCreateBulkJob } from '../_lib/quota.js';
import { logger } from '../_lib/logger.js';
import { z } from 'zod';

const BulkUploadSchema = z.object({
  file_name: z.string(),
  rows: z.array(z.object({
    address: z.string(),
    beds: z.number().int().positive().optional(),
    baths: z.number().positive().optional(),
    sqft: z.number().int().positive().optional(),
    property_type: z.string().optional(),
    amenities: z.array(z.string()).optional(),
  })),
  team_id: z.string().uuid().optional(),
});

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

    const validationResult = BulkUploadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const { file_name, rows, team_id } = validationResult.data;

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Check quota
    const bulkCheck = canBulkGenerate(profile, rows.length);
    if (!bulkCheck.allowed) {
      return res.status(403).json({
        error: bulkCheck.reason,
        code: 'QUOTA_EXCEEDED',
      });
    }

    const jobCheck = await canCreateBulkJob(profile);
    if (!jobCheck.allowed) {
      return res.status(403).json({
        error: jobCheck.reason,
        code: 'QUOTA_EXCEEDED',
      });
    }

    // Verify team access if team_id provided
    if (team_id) {
      const supabase = createServiceClient();
      const { data: membership } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        return res.status(403).json({ error: 'Not a team member' });
      }
    }

    const supabase = createServiceClient();

    // Create bulk job
    const { data: bulkJob, error: jobError } = await supabase
      .from('bulk_jobs')
      .insert({
        user_id: user.id,
        team_id: team_id || null,
        file_name,
        total_rows: rows.length,
        processed_rows: 0,
        failed_rows: 0,
        status: 'pending',
      })
      .select()
      .single();

    if (jobError || !bulkJob) {
      logger.error('Bulk job creation error:', jobError);
      return res.status(500).json({ error: 'Failed to create bulk job' });
    }

    // Create bulk job items
    const items = rows.map((row, index) => ({
      bulk_job_id: bulkJob.id,
      row_number: index + 1,
      input_data: row,
      status: 'pending' as const,
    }));

    const { error: itemsError } = await supabase
      .from('bulk_job_items')
      .insert(items);

    if (itemsError) {
      logger.error('Bulk job items creation error:', itemsError);
      // Mark job as failed
      await supabase
        .from('bulk_jobs')
        .update({ status: 'failed' })
        .eq('id', bulkJob.id);
      return res.status(500).json({ error: 'Failed to create bulk job items' });
    }

    // Trigger processing (would be handled by cron job in production)
    // For now, return job ID for client to poll

    return res.status(200).json({
      success: true,
      data: {
        job_id: bulkJob.id,
        status: bulkJob.status,
        total_rows: bulkJob.total_rows,
      },
    });
  } catch (error) {
    logger.error('Bulk upload error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

