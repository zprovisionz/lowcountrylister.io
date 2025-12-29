import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import { logger } from './_lib/logger.js';
import { z } from 'zod';

const InviteTeamSchema = z.object({
  team_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'agent']).optional().default('agent'),
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

    const validationResult = InviteTeamSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const { team_id, email, role } = validationResult.data;
    const supabase = createServiceClient();

    // Check if user has permission to invite (admin or manager)
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || (membership.role !== 'admin' && membership.role !== 'manager')) {
      return res.status(403).json({ error: 'Insufficient permissions to invite members' });
    }

    // Check if invitee role is valid (managers can't invite admins)
    if (membership.role === 'manager' && role === 'admin') {
      return res.status(403).json({ error: 'Managers cannot invite admins' });
    }

    // Find user by email
    const { data: inviteeUser } = await supabase.auth.admin.getUserByEmail(email);

    if (!inviteeUser?.user) {
      // User doesn't exist yet - could send email invite here
      // For now, return error asking user to sign up first
      return res.status(404).json({
        error: 'User not found',
        message: 'Please ask the user to create an account first, then try again.',
      });
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', inviteeUser.user.id)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    // Add team member
    const { data: newMember, error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id,
        user_id: inviteeUser.user.id,
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (memberError || !newMember) {
      logger.error('Team member invite error:', memberError);
      return res.status(500).json({ error: 'Failed to invite team member' });
    }

    // TODO: Send invitation email notification

    return res.status(200).json({
      success: true,
      data: newMember,
    });
  } catch (error) {
    logger.error('Team invite error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

