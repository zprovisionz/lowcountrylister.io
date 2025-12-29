import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import { logger } from './_lib/logger.js';
import { z } from 'zod';

const JoinTeamSchema = z.object({
  team_id: z.string().uuid(),
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

    const validationResult = JoinTeamSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const { team_id } = validationResult.data;
    const supabase = createServiceClient();

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({ error: 'Already a team member' });
    }

    // Verify team exists
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('id', team_id)
      .maybeSingle();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Add user as agent member (default role for joining)
    const { data: newMember, error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id,
        user_id: user.id,
        role: 'agent',
      })
      .select()
      .single();

    if (memberError || !newMember) {
      logger.error('Team join error:', memberError);
      return res.status(500).json({ error: 'Failed to join team' });
    }

    // Update user's current team
    await supabase
      .from('user_profiles')
      .update({ current_team_id: team_id })
      .eq('id', user.id);

    return res.status(200).json({
      success: true,
      data: newMember,
    });
  } catch (error) {
    logger.error('Team join error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

