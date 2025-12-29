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

    const supabase = createServiceClient();
    const days = parseInt(req.query.days as string) || 30;

    // Get user's team IDs for shared generation access
    const { data: teams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    const teamIds = teams?.map(t => t.team_id) || [];

    // Build query: user's own generations
    const { data: userGenerations } = await supabase
      .from('generations')
      .select('id, address, created_at, team_id, is_shared')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    // If user has teams, also fetch shared team generations
    let teamGenerations: any[] = [];
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('generations')
        .select('id, address, created_at, team_id, is_shared')
        .in('team_id', teamIds)
        .eq('is_shared', true)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
      teamGenerations = data || [];
    }

    // Combine user and team generations, removing duplicates by ID
    const allGenerationsMap = new Map<string, any>();
    (userGenerations || []).forEach(g => allGenerationsMap.set(g.id, g));
    teamGenerations.forEach(g => allGenerationsMap.set(g.id, g));
    const generations = { data: Array.from(allGenerationsMap.values()) };

    const generationIds = generations?.map(g => g.id) || [];

    if (generationIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          total_generations: 0,
          total_views: 0,
          total_copies: 0,
          total_external_views: 0,
          top_generations: [],
          sources: {},
          trends: [],
        },
      });
    }

    // Get all events for user's generations
    const { data: events } = await supabase
      .from('analytics_events')
      .select('*')
      .in('generation_id', generationIds)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    // Aggregate stats
    const totalViews = events?.filter(e => e.event_type === 'view' || e.event_type === 'external_view').length || 0;
    const totalCopies = events?.filter(e => e.event_type === 'copy').length || 0;
    const totalExternalViews = events?.filter(e => e.event_type === 'external_view').length || 0;

    // Top generations by views
    const generationViews: Record<string, number> = {};
    events?.forEach(event => {
      if (event.event_type === 'view' || event.event_type === 'external_view') {
        generationViews[event.generation_id] = (generationViews[event.generation_id] || 0) + 1;
      }
    });

    const topGenerations = Object.entries(generationViews)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id, views]) => {
        const gen = generations?.find(g => g.id === id);
        return {
          generation_id: id,
          address: gen?.address || 'Unknown',
          views,
        };
      });

    // Source breakdown
    const sources = {
      mls: events?.filter(e => e.source === 'mls').length || 0,
      zillow: events?.filter(e => e.source === 'zillow').length || 0,
      realtor: events?.filter(e => e.source === 'realtor').length || 0,
      email: events?.filter(e => e.source === 'email').length || 0,
      app: events?.filter(e => e.source === 'app').length || 0,
      other: events?.filter(e => e.source === 'other').length || 0,
    };

    // Daily trends (last 30 days)
    const trends = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayEvents = events?.filter(e => {
        const eventDate = new Date(e.created_at);
        return eventDate >= date && eventDate < nextDate;
      }) || [];

      trends.push({
        date: date.toISOString().split('T')[0],
        views: dayEvents.filter(e => e.event_type === 'view' || e.event_type === 'external_view').length,
        copies: dayEvents.filter(e => e.event_type === 'copy').length,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        total_generations: generations?.length || 0,
        total_views: totalViews,
        total_copies: totalCopies,
        total_external_views: totalExternalViews,
        top_generations: topGenerations,
        sources,
        trends,
      },
    });
  } catch (error) {
    logger.error('Dashboard analytics error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

