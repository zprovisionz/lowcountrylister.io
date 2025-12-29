import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import { logger } from './_lib/logger.js';
import { z } from 'zod';

const UpdateBrandingSchema = z.object({
  team_id: z.string().uuid(),
  branding: z.object({
    logo_url: z.string().url().optional(),
    primary_color: z.string().optional(),
    tagline: z.string().max(200).optional(),
  }),
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validationResult = UpdateBrandingSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const { team_id, branding } = validationResult.data;
    const supabase = createServiceClient();

    // Check if user is admin of the team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    // Also check if user is team owner
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', team_id)
      .maybeSingle();

    const isOwner = team?.owner_id === user.id;
    const isAdmin = membership?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can update team branding' });
    }

    // Get current branding and merge
    const { data: currentTeam } = await supabase
      .from('teams')
      .select('branding')
      .eq('id', team_id)
      .maybeSingle();

    const updatedBranding = {
      ...(currentTeam?.branding || {}),
      ...branding,
    };

    // Update branding
    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update({
        branding: updatedBranding,
        updated_at: new Date().toISOString(),
      })
      .eq('id', team_id)
      .select()
      .single();

    if (updateError || !updatedTeam) {
      logger.error('Branding update error:', updateError);
      return res.status(500).json({ error: 'Failed to update branding' });
    }

    return res.status(200).json({
      success: true,
      data: updatedTeam,
    });
  } catch (error) {
    logger.error('Branding update error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

