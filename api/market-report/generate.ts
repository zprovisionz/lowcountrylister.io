import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from '../../_lib/supabase.js';
import { createServiceClient } from '../../_lib/supabase.js';
import { logger } from '../../_lib/logger.js';
import { z } from 'zod';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const GenerateReportSchema = z.object({
  report_type: z.enum(['neighborhood', 'zip', 'custom_area']),
  neighborhood: z.string().optional(),
  zip_code: z.string().optional(),
  team_id: z.string().uuid().optional(),
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

    const validationResult = GenerateReportSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const { report_type, neighborhood, zip_code, team_id } = validationResult.data;
    const supabase = createServiceClient();

    // Verify team access if team_id provided
    if (team_id) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        return res.status(403).json({ error: 'Not a team member' });
      }
    }

    // Get comps data
    let compsQuery = supabase
      .from('comparable_listings')
      .select('*')
      .order('sold_date', { ascending: false, nullsFirst: false })
      .limit(100);

    if (report_type === 'neighborhood' && neighborhood) {
      compsQuery = compsQuery.ilike('neighborhood', `%${neighborhood}%`);
    } else if (report_type === 'zip' && zip_code) {
      compsQuery = compsQuery.eq('zip_code', zip_code);
    }

    const { data: comps } = await compsQuery;

    if (!comps || comps.length === 0) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: 'Not enough comparable listings found for this area.',
      });
    }

    // Calculate stats
    const soldComps = comps.filter(c => c.sold_price && c.sold_date);
    const medianPrice = soldComps.length > 0
      ? soldComps.sort((a, b) => (a.sold_price || 0) - (b.sold_price || 0))[
          Math.floor(soldComps.length / 2)
        ].sold_price || 0
      : 0;

    const avgPricePerSqft = soldComps.length > 0
      ? soldComps.reduce((sum, c) => sum + ((c.sold_price || 0) / (c.sqft || 1)), 0) / soldComps.length
      : 0;

    const avgDaysOnMarket = soldComps.length > 0
      ? soldComps.reduce((sum, c) => sum + (c.days_on_market || 0), 0) / soldComps.length
      : 0;

    // Generate AI narrative
    const narrativePrompt = `Write a 200-word market analysis for ${neighborhood || zip_code || 'the Charleston area'} based on these statistics:

Median Sold Price: $${medianPrice.toLocaleString()}
Average Price per Sqft: $${avgPricePerSqft.toFixed(2)}
Average Days on Market: ${avgPricePerSqft.toFixed(0)} days
Recent Sales: ${soldComps.length} properties

Focus on market trends, buyer demand, and what sellers should know. Use Charleston real estate terminology.`;

    let marketNarrative = '';
    try {
      const narrativeResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: narrativePrompt }],
        max_tokens: 300,
        temperature: 0.7,
      });
      marketNarrative = narrativeResponse.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Market narrative generation error:', error);
      marketNarrative = `The ${neighborhood || zip_code || 'area'} shows a median sold price of $${medianPrice.toLocaleString()} with an average of ${avgDaysOnMarket.toFixed(0)} days on market.`;
    }

    const reportData = {
      median_price: medianPrice,
      price_per_sqft: avgPricePerSqft,
      days_on_market_avg: avgDaysOnMarket,
      inventory_levels: comps.length,
      recent_sales: soldComps.slice(0, 10),
      market_narrative: marketNarrative,
      comparable_properties: comps.slice(0, 20),
      trends: {
        price_trend: 'stable' as const,
        inventory_trend: 'stable' as const,
        days_on_market_trend: 'stable' as const,
      },
    };

    // Save report
    const { data: report, error: reportError } = await supabase
      .from('market_reports')
      .insert({
        user_id: user.id,
        team_id: team_id || null,
        neighborhood: neighborhood || null,
        zip_code: zip_code || null,
        report_type,
        report_data: reportData,
      })
      .select()
      .single();

    if (reportError || !report) {
      logger.error('Market report creation error:', reportError);
      return res.status(500).json({ error: 'Failed to save report' });
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Market report generation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

