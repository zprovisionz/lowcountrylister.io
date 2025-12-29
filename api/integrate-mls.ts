import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import { getUserProfile } from './_lib/quota.js';
import { logger } from './_lib/logger.js';
import { z } from 'zod';

const MLSConnectSchema = z.object({
  provider: z.enum(['reso_web_api', 'bright_mls', 'matrix', 'other']),
  mls_name: z.string().min(1),
  api_base_url: z.string().url(),
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  token_expires_at: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  team_id: z.string().uuid().optional(),
});

const MLSPullPropertySchema = z.object({
  connection_id: z.string().uuid(),
  mls_number: z.string().min(1),
  team_id: z.string().uuid().optional(),
});

/**
 * POST /api/integrate-mls
 * 
 * Connect an MLS account or pull property data
 * 
 * Operations:
 * - connect: Store MLS connection credentials
 * - pull: Fetch property data from MLS API
 */
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

    const { operation } = req.body;

    if (operation === 'connect') {
      // Connect/Store MLS credentials
      const validationResult = MLSConnectSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;
      const profile = await getUserProfile(user.id);
      if (!profile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      // Verify team access if team_id provided
      if (data.team_id) {
        const supabase = createServiceClient();
        const { data: membership } = await supabase
          .from('team_members')
          .select('id, role')
          .eq('team_id', data.team_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          return res.status(403).json({ error: 'Only team owners/admins can connect MLS' });
        }
      }

      const supabase = createServiceClient();

      // Check for existing connection
      const existingQuery = supabase
        .from('mls_connections')
        .select('id')
        .eq('provider', data.provider)
        .eq('mls_name', data.mls_name);

      if (data.team_id) {
        existingQuery.eq('team_id', data.team_id);
      } else {
        existingQuery.eq('user_id', user.id).is('team_id', null);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      let connection;
      if (existing) {
        // Update existing connection
        const { data: updated, error: updateError } = await supabase
          .from('mls_connections')
          .update({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_expires_at: data.token_expires_at,
            api_base_url: data.api_base_url,
            is_active: true,
            metadata: data.metadata || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError || !updated) {
          logger.error('MLS connection update error:', updateError);
          return res.status(500).json({ error: 'Failed to update MLS connection' });
        }

        connection = updated;
      } else {
        // Create new connection
        const { data: created, error: createError } = await supabase
          .from('mls_connections')
          .insert({
            user_id: data.team_id ? null : user.id,
            team_id: data.team_id || null,
            provider: data.provider,
            mls_name: data.mls_name,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_expires_at: data.token_expires_at,
            api_base_url: data.api_base_url,
            metadata: data.metadata || {},
            is_active: true,
          })
          .select()
          .single();

        if (createError || !created) {
          logger.error('MLS connection creation error:', createError);
          return res.status(500).json({ error: 'Failed to create MLS connection' });
        }

        connection = created;
      }

      return res.status(200).json({
        success: true,
        data: {
          connection_id: connection.id,
          provider: connection.provider,
          mls_name: connection.mls_name,
          is_active: connection.is_active,
        },
      });
    }

    if (operation === 'pull') {
      // Pull property data from MLS
      const validationResult = MLSPullPropertySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
      }

      const { connection_id, mls_number, team_id } = validationResult.data;

      const supabase = createServiceClient();

      // Fetch connection
      const connectionQuery = supabase
        .from('mls_connections')
        .select('*')
        .eq('id', connection_id)
        .eq('is_active', true);

      const { data: connection, error: connError } = await connectionQuery.maybeSingle();

      if (connError || !connection) {
        return res.status(404).json({ error: 'MLS connection not found' });
      }

      // Verify access
      if (connection.team_id) {
        if (!team_id || connection.team_id !== team_id) {
          return res.status(403).json({ error: 'Team ID mismatch' });
        }

        const { data: membership } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', team_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) {
          return res.status(403).json({ error: 'Not a team member' });
        }
      } else {
        if (connection.user_id !== user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      // Check token expiration
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        return res.status(401).json({
          error: 'MLS token expired',
          code: 'TOKEN_EXPIRED',
          requires_refresh: true,
        });
      }

      // Fetch property from MLS API
      try {
        const propertyData = await fetchMLSProperty(
          connection,
          mls_number
        );

        return res.status(200).json({
          success: true,
          data: {
            mls_number: propertyData.mls_number,
            address: propertyData.address,
            beds: propertyData.beds,
            baths: propertyData.baths,
            sqft: propertyData.sqft,
            property_type: propertyData.property_type,
            list_price: propertyData.list_price,
            year_built: propertyData.year_built,
            lot_size: propertyData.lot_size,
            description: propertyData.description,
            photos: propertyData.photos || [],
            amenities: propertyData.amenities || [],
            raw_data: propertyData.raw_data,
          },
        });
      } catch (mlsError: any) {
        logger.error('MLS API error:', mlsError);
        return res.status(500).json({
          error: 'Failed to fetch property from MLS',
          details: mlsError.message,
        });
      }
    }

    return res.status(400).json({
      error: 'Invalid operation',
      valid_operations: ['connect', 'pull'],
    });
  } catch (error) {
    logger.error('MLS integration error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Fetch property data from MLS API
 */
async function fetchMLSProperty(
  connection: any,
  mlsNumber: string
): Promise<any> {
  const apiUrl = `${connection.api_base_url}/properties/${mlsNumber}`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('MLS authentication failed - token may be expired');
    }
    throw new Error(`MLS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Normalize property data based on provider
  return normalizeMLSProperty(data, connection.provider);
}

/**
 * Normalize MLS property data to our format
 */
function normalizeMLSProperty(data: any, provider: string): any {
  // RESO Web API standard format
  if (provider === 'reso_web_api') {
    return {
      mls_number: data.ListingId || data.MLSNumber || data.MlsNumber,
      address: data.Property?.Address?.StreetName 
        ? `${data.Property.Address.StreetNumber || ''} ${data.Property.Address.StreetName}${data.Property.Address.StreetSuffix ? ' ' + data.Property.Address.StreetSuffix : ''}, ${data.Property.Address.City}, ${data.Property.Address.StateOrProvince} ${data.Property.Address.PostalCode}`
        : data.UnparsedAddress || data.Address,
      beds: data.Property?.BedroomsTotal || data.BedroomsTotal || data.Beds,
      baths: data.Property?.BathroomsTotalInteger || data.BathroomsTotalInteger || data.Baths,
      sqft: data.Property?.LivingArea || data.LivingArea || data.SquareFeet,
      property_type: data.PropertyType || data.Property?.PropertyType || 'Other',
      list_price: data.ListPrice || data.ListPriceDisplay || null,
      year_built: data.Property?.YearBuilt || data.YearBuilt,
      lot_size: data.Property?.LotSizeSquareFeet || data.LotSizeSquareFeet,
      description: data.PublicRemarks || data.Remarks || data.Description || '',
      photos: data.Media?.filter((m: any) => m.MediaCategory === 'Photo' || m.Type === 'Photo').map((m: any) => m.MediaURL || m.Url) || [],
      amenities: data.Features || data.Property?.Features || [],
      raw_data: data,
    };
  }

  // Bright MLS format
  if (provider === 'bright_mls') {
    return {
      mls_number: data.mlsNumber || data.MLSNumber,
      address: data.address?.full || data.fullAddress || data.address,
      beds: data.bedrooms || data.beds,
      baths: data.bathrooms || data.baths,
      sqft: data.squareFeet || data.sqft || data.livingArea,
      property_type: data.propertyType || data.propertySubType || 'Other',
      list_price: data.listPrice || data.price,
      year_built: data.yearBuilt,
      lot_size: data.lotSize,
      description: data.remarks || data.description || '',
      photos: data.photos || data.media?.photos || [],
      amenities: data.features || [],
      raw_data: data,
    };
  }

  // Generic fallback
  return {
    mls_number: data.mls_number || data.mlsNumber || data.MLSNumber || data.id,
    address: data.address || data.Address || data.fullAddress || '',
    beds: data.beds || data.bedrooms || data.BedroomsTotal || null,
    baths: data.baths || data.bathrooms || data.BathroomsTotalInteger || null,
    sqft: data.sqft || data.squareFeet || data.square_feet || data.LivingArea || null,
    property_type: data.property_type || data.propertyType || data.PropertyType || 'Other',
    list_price: data.list_price || data.listPrice || data.ListPrice || null,
    year_built: data.year_built || data.yearBuilt || data.YearBuilt || null,
    lot_size: data.lot_size || data.lotSize || data.LotSizeSquareFeet || null,
    description: data.description || data.Description || data.remarks || data.PublicRemarks || '',
    photos: data.photos || data.Photos || data.media?.photos || [],
    amenities: data.amenities || data.Amenities || data.features || [],
    raw_data: data,
  };
}

