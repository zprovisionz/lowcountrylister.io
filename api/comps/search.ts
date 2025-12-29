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
    let query = supabase
      .from('comparable_listings')
      .select('*')
      .order('sold_date', { ascending: false, nullsFirst: false });

    // Apply filters
    const zipCode = req.query.zip_code as string;
    const neighborhood = req.query.neighborhood as string;
    const propertyType = req.query.property_type as string;
    const minBeds = req.query.min_beds ? parseInt(req.query.min_beds as string) : null;
    const maxBeds = req.query.max_beds ? parseInt(req.query.max_beds as string) : null;
    const minSqft = req.query.min_sqft ? parseInt(req.query.min_sqft as string) : null;
    const maxSqft = req.query.max_sqft ? parseInt(req.query.max_sqft as string) : null;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (zipCode) {
      query = query.eq('zip_code', zipCode);
    }

    if (neighborhood) {
      query = query.ilike('neighborhood', `%${neighborhood}%`);
    }

    if (propertyType) {
      query = query.eq('property_type', propertyType);
    }

    if (minBeds !== null) {
      query = query.gte('beds', minBeds);
    }

    if (maxBeds !== null) {
      query = query.lte('beds', maxBeds);
    }

    if (minSqft !== null) {
      query = query.gte('sqft', minSqft);
    }

    if (maxSqft !== null) {
      query = query.lte('sqft', maxSqft);
    }

    query = query.limit(limit);

    const { data: comps, error: compsError } = await query;

    if (compsError) {
      logger.error('Comp search error:', compsError);
      return res.status(500).json({ error: 'Failed to search comps' });
    }

    return res.status(200).json({
      success: true,
      data: comps || [],
    });
  } catch (error) {
    logger.error('Comp search error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

