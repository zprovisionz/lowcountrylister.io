import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from '../_lib/supabase.js';
import { createServiceClient } from '../_lib/supabase.js';
import { logger } from '../_lib/logger.js';
import { z } from 'zod';

const AnalyticsEventSchema = z.object({
  generation_id: z.string().uuid(),
  event_type: z.enum(['view', 'copy', 'external_view', 'click', 'regenerate']),
  metadata: z.record(z.any()).optional(),
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

    const validationResult = AnalyticsEventSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const { generation_id, event_type, metadata } = validationResult.data;
    const supabase = createServiceClient();

    // Verify user owns the generation or is a team member with access
    const { data: generation } = await supabase
      .from('generations')
      .select('id, user_id, team_id, is_shared')
      .eq('id', generation_id)
      .maybeSingle();

    if (!generation) {
      return res.status(404).json({ error: 'Generation not found' });
    }

    // Check access: owner or team member viewing shared generation
    const isOwner = generation.user_id === user.id;
    const hasTeamAccess = generation.is_shared && generation.team_id && 
      await (async () => {
        const { data: membership } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', generation.team_id)
          .eq('user_id', user.id)
          .maybeSingle();
        return !!membership;
      })();

    if (!isOwner && !hasTeamAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Record event
    const { data: event, error: eventError } = await supabase
      .from('analytics_events')
      .insert({
        generation_id,
        event_type,
        source: 'app',
        metadata: metadata || {},
      })
      .select()
      .single();

    if (eventError || !event) {
      logger.error('Analytics event creation error:', eventError);
      return res.status(500).json({ error: 'Failed to record event' });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    logger.error('Analytics event error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

