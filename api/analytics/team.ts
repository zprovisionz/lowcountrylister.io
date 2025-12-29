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

    const teamId = req.query.team_id as string;
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID required' });
    }

    const supabase = createServiceClient();

    // Verify user is team member (admin or manager for analytics)
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || (membership.role !== 'admin' && membership.role !== 'manager')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const days = parseInt(req.query.days as string) || 30;

    // Get team generations
    const { data: generations } = await supabase
      .from('generations')
      .select('id, address, user_id, created_at')
      .eq('team_id', teamId)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    const generationIds = generations?.map(g => g.id) || [];

    if (generationIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          total_generations: 0,
          total_views: 0,
          total_copies: 0,
          team_member_stats: [],
        },
      });
    }

    // Get all events
    const { data: events } = await supabase
      .from('analytics_events')
      .select('*')
      .in('generation_id', generationIds)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    // Aggregate by team member
    const memberStats: Record<string, {
      user_id: string;
      generations: number;
      views: number;
      copies: number;
    }> = {};

    generations?.forEach(gen => {
      if (!memberStats[gen.user_id]) {
        memberStats[gen.user_id] = {
          user_id: gen.user_id,
          generations: 0,
          views: 0,
          copies: 0,
        };
      }
      memberStats[gen.user_id].generations++;
    });

    events?.forEach(event => {
      const gen = generations?.find(g => g.id === event.generation_id);
      if (gen && memberStats[gen.user_id]) {
        if (event.event_type === 'view' || event.event_type === 'external_view') {
          memberStats[gen.user_id].views++;
        } else if (event.event_type === 'copy') {
          memberStats[gen.user_id].copies++;
        }
      }
    });

    // Get user emails for stats
    const userIds = Object.keys(memberStats);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds);

    const teamMemberStats = Object.values(memberStats).map(stat => ({
      ...stat,
      email: profiles?.find(p => p.id === stat.user_id)?.email || 'Unknown',
    }));

    const totalViews = events?.filter(e => e.event_type === 'view' || e.event_type === 'external_view').length || 0;
    const totalCopies = events?.filter(e => e.event_type === 'copy').length || 0;

    return res.status(200).json({
      success: true,
      data: {
        total_generations: generations?.length || 0,
        total_views: totalViews,
        total_copies: totalCopies,
        team_member_stats: teamMemberStats,
      },
    });
  } catch (error) {
    logger.error('Team analytics error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

