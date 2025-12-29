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

    const generationId = req.query.id as string;
    if (!generationId) {
      return res.status(400).json({ error: 'Generation ID required' });
    }

    const supabase = createServiceClient();

    // Verify user has access to generation
    const { data: generation } = await supabase
      .from('generations')
      .select('id, user_id, team_id, is_shared')
      .eq('id', generationId)
      .maybeSingle();

    if (!generation) {
      return res.status(404).json({ error: 'Generation not found' });
    }

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

    // Get all events for this generation
    const { data: events, error: eventsError } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('generation_id', generationId)
      .order('created_at', { ascending: false });

    if (eventsError) {
      logger.error('Analytics fetch error:', eventsError);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    // Aggregate stats
    const stats = {
      total_views: events?.filter(e => e.event_type === 'view' || e.event_type === 'external_view').length || 0,
      internal_views: events?.filter(e => e.event_type === 'view').length || 0,
      external_views: events?.filter(e => e.event_type === 'external_view').length || 0,
      copies: events?.filter(e => e.event_type === 'copy').length || 0,
      regenerates: events?.filter(e => e.event_type === 'regenerate').length || 0,
      clicks: events?.filter(e => e.event_type === 'click').length || 0,
      sources: {
        mls: events?.filter(e => e.source === 'mls').length || 0,
        zillow: events?.filter(e => e.source === 'zillow').length || 0,
        realtor: events?.filter(e => e.source === 'realtor').length || 0,
        email: events?.filter(e => e.source === 'email').length || 0,
        app: events?.filter(e => e.source === 'app').length || 0,
        other: events?.filter(e => e.source === 'other').length || 0,
      },
      events: events || [],
    };

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Generation analytics error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

