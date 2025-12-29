import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from '../_lib/supabase.js';
import { logger } from '../_lib/logger.js';

// 1x1 transparent GIF
const GIF_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const trackingId = req.query.id as string;
    if (!trackingId) {
      return res.status(400).json({ error: 'Tracking ID required' });
    }

    const supabase = createServiceClient();

    // Find generation by tracking_id
    const { data: generation } = await supabase
      .from('generations')
      .select('id')
      .eq('tracking_id', trackingId)
      .maybeSingle();

    if (!generation) {
      // Still return pixel even if generation not found (avoid breaking tracking)
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(GIF_PIXEL);
    }

    // Extract metadata from request
    const referrer = req.headers.referer || req.headers.referrer || null;
    const userAgent = req.headers['user-agent'] || null;
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
    
    // Parse referrer to determine source
    let source: 'mls' | 'zillow' | 'email' | 'realtor' | 'other' = 'other';
    if (referrer) {
      const referrerLower = referrer.toLowerCase();
      if (referrerLower.includes('mls') || referrerLower.includes('matrix')) {
        source = 'mls';
      } else if (referrerLower.includes('zillow')) {
        source = 'zillow';
      } else if (referrerLower.includes('realtor.com')) {
        source = 'realtor';
      } else if (referrerLower.includes('mail') || referrerLower.includes('email')) {
        source = 'email';
      }
    }

    // Record analytics event
    const { error: eventError } = await supabase
      .from('analytics_events')
      .insert({
        generation_id: generation.id,
        event_type: 'external_view',
        source,
        metadata: {
          referrer,
          user_agent: userAgent,
          ip_address: typeof ip === 'string' ? ip.split(',')[0] : null,
          timestamp: new Date().toISOString(),
        },
        tracking_id: trackingId,
      });

    if (eventError) {
      logger.error('Analytics event creation error:', eventError);
      // Continue to return pixel even if logging fails
    }

    // Return 1x1 transparent GIF
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(GIF_PIXEL);
  } catch (error) {
    logger.error('Tracking pixel error:', error);
    // Always return pixel even on error
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(GIF_PIXEL);
  }
}

