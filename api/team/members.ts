import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import { logger } from './_lib/logger.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    return getMembers(req, res);
  } else if (req.method === 'PATCH') {
    return updateMember(req, res);
  } else if (req.method === 'DELETE') {
    return removeMember(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getMembers(
  req: VercelRequest,
  res: VercelResponse
) {

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const teamId = req.query.team_id as string;
    if (!teamId) {
      return res.status(400).json({ error: 'team_id query parameter required' });
    }

    const supabase = createServiceClient();

    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get all team members with user profile info
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        id,
        role,
        invited_by,
        joined_at,
        user_id,
        user_profiles:user_id (
          email
        )
      `)
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      logger.error('Team members fetch error:', membersError);
      return res.status(500).json({ error: 'Failed to fetch team members' });
    }

    // Transform data to include email from user_profiles
    const formattedMembers = members?.map((member: any) => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      invited_by: member.invited_by,
      joined_at: member.joined_at,
      email: member.user_profiles?.email || null,
    })) || [];

    return res.status(200).json({
      success: true,
      data: formattedMembers,
    });
  } catch (error) {
    logger.error('Team members error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// PATCH /api/team/members?id=:id - Update member role
async function updateMember(
  req: VercelRequest,
  res: VercelResponse
) {

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const memberId = req.query.id as string;
    const { role } = req.body;

    if (!memberId || !role) {
      return res.status(400).json({ error: 'Member ID and role required' });
    }

    if (!['admin', 'manager', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const supabase = createServiceClient();

    // Get member's team_id
    const { data: member } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('id', memberId)
      .maybeSingle();

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Check if requester is admin of the team
    const { data: requesterMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', member.team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update member roles' });
    }

    // Update member role
    const { data: updatedMember, error: updateError } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single();

    if (updateError || !updatedMember) {
      logger.error('Member role update error:', updateError);
      return res.status(500).json({ error: 'Failed to update member role' });
    }

    return res.status(200).json({
      success: true,
      data: updatedMember,
    });
  } catch (error) {
    logger.error('Update member error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// DELETE /api/team/members?id=:id - Remove member
async function removeMember(
  req: VercelRequest,
  res: VercelResponse
) {

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const memberId = req.query.id as string;
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID required' });
    }

    const supabase = createServiceClient();

    // Get member's team_id and user_id
    const { data: member } = await supabase
      .from('team_members')
      .select('team_id, user_id')
      .eq('id', memberId)
      .maybeSingle();

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Prevent removing team owner
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', member.team_id)
      .maybeSingle();

    if (team?.owner_id === member.user_id) {
      return res.status(400).json({ error: 'Cannot remove team owner' });
    }

    // Check if requester is admin
    const { data: requesterMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', member.team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      logger.error('Member removal error:', deleteError);
      return res.status(500).json({ error: 'Failed to remove member' });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('Remove member error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

