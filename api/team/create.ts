import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import { logger } from './_lib/logger.js';
import { z } from 'zod';

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  branding: z.object({
    logo_url: z.string().url().optional(),
    primary_color: z.string().optional(),
    tagline: z.string().max(200).optional(),
  }).optional(),
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

    const validationResult = CreateTeamSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const { name, branding } = validationResult.data;
    const supabase = createServiceClient();

    // Generate slug from name
    const generateSlug = (teamName: string): string => {
      const base = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return base;
    };

    let slug = generateSlug(name);
    let counter = 0;
    let finalSlug = slug;

    // Ensure slug uniqueness
    while (true) {
      const { data: existing } = await supabase
        .from('teams')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle();

      if (!existing) break;
      counter++;
      finalSlug = `${slug}-${counter}`;
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        slug: finalSlug,
        owner_id: user.id,
        branding: branding || {},
        subscription_tier: 'team',
      })
      .select()
      .single();

    if (teamError || !team) {
      logger.error('Team creation error:', teamError);
      return res.status(500).json({ error: 'Failed to create team' });
    }

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'admin',
        invited_by: user.id,
      });

    if (memberError) {
      logger.error('Team member creation error:', memberError);
      // Team was created but member insert failed - delete team
      await supabase.from('teams').delete().eq('id', team.id);
      return res.status(500).json({ error: 'Failed to create team membership' });
    }

    // Update user's current team
    await supabase
      .from('user_profiles')
      .update({ current_team_id: team.id })
      .eq('id', user.id);

    return res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    logger.error('Team creation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

