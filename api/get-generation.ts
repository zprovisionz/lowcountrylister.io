import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './_lib/supabase';
import { logger } from './_lib/logger';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Generation ID is required' });
    }

    // Get authentication token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const supabase = createServiceClient();

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Fetch the generation
    const { data: generation, error: fetchError } = await supabase
      .from('generations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      logger.error('Error fetching generation:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Generation not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch generation' });
    }

    // Also check anonymous_generations if not found in main table
    // (for cases where user just signed up and generation was linked)
    if (!generation) {
      const { data: anonymousGen, error: anonError } = await supabase
        .from('anonymous_generations')
        .select('*')
        .eq('id', id)
        .eq('linked_user_id', user.id)
        .single();

      if (!anonError && anonymousGen) {
        // Return the anonymous generation data
        return res.status(200).json({
          success: true,
          data: {
            id: anonymousGen.id,
            address: anonymousGen.address,
            mls_description: anonymousGen.mls_description,
            preview_snippet: anonymousGen.preview_snippet,
            geocoding_data: anonymousGen.geocoding_data,
            neighborhood_data: anonymousGen.neighborhood_data,
            created_at: anonymousGen.created_at,
            // Note: Anonymous generations may not have all fields
            property_type: 'single_family', // Default
            bedrooms: undefined,
            bathrooms: undefined,
            square_feet: undefined,
            amenities: [],
            photo_urls: [],
            include_airbnb: false,
            include_social: false,
          },
        });
      }

      // Neither main generation nor anonymous generation found
      return res.status(404).json({ error: 'Generation not found' });
    }

    return res.status(200).json({
      success: true,
      data: generation,
    });
  } catch (error) {
    logger.error('Error in get-generation:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

