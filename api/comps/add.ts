import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from '../_lib/supabase.js';
import { createServiceClient } from '../_lib/supabase.js';
import { logger } from '../_lib/logger.js';
import { z } from 'zod';

const AddCompSchema = z.object({
  address: z.string().min(1),
  zip_code: z.string().optional(),
  neighborhood: z.string().optional(),
  property_type: z.string().optional(),
  beds: z.number().int().positive().optional(),
  baths: z.number().positive().optional(),
  sqft: z.number().int().positive().optional(),
  list_price: z.number().positive().optional(),
  sold_price: z.number().positive().optional(),
  days_on_market: z.number().int().positive().optional(),
  sold_date: z.string().optional(), // ISO date string
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

    const validationResult = AddCompSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;
    const supabase = createServiceClient();

    // Add comp
    const { data: comp, error: compError } = await supabase
      .from('comparable_listings')
      .insert({
        address: data.address,
        zip_code: data.zip_code || null,
        neighborhood: data.neighborhood || null,
        property_type: data.property_type || null,
        beds: data.beds || null,
        baths: data.baths || null,
        sqft: data.sqft || null,
        list_price: data.list_price || null,
        sold_price: data.sold_price || null,
        days_on_market: data.days_on_market || null,
        sold_date: data.sold_date || null,
        data_source: 'manual',
        created_by: user.id,
      })
      .select()
      .single();

    if (compError || !comp) {
      logger.error('Comp addition error:', compError);
      return res.status(500).json({ error: 'Failed to add comp' });
    }

    return res.status(200).json({
      success: true,
      data: comp,
    });
  } catch (error) {
    logger.error('Add comp error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

