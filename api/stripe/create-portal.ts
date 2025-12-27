import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getUserFromToken } from '../_lib/supabase';
import { getUserProfile } from '../_lib/quota';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
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

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (!profile.stripe_customer_id) {
      return res.status(400).json({
        error: 'No Stripe customer ID found. Please subscribe to a plan first.',
      });
    }

    // Create Stripe billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.headers.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/account?tab=billing`,
    });

    return res.status(200).json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Portal creation error:', error);
    return res.status(500).json({
      error: 'Failed to create billing portal session',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

