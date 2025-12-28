import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createServiceClient } from '../_lib/supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'] as string;

    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log('Received Stripe event:', event.type, event.id);

    const supabase = createServiceClient();
    
    // Log event details for debugging
    console.log('Event details:', {
      type: event.type,
      id: event.id,
      created: new Date(event.created * 1000).toISOString(),
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;

        if (!userId) {
          console.error('No user ID in session metadata');
          break;
        }

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          const priceId = subscription.items.data[0]?.price.id;
          const tier = mapPriceIdToTier(priceId);

          await supabase
            .from('user_profiles')
            .update({
              subscription_tier: tier,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer as string,
              billing_period_start: new Date().toISOString(),
              last_reset_date: new Date().toISOString(),
              generations_this_month: 0,
              staging_credits_used_this_month: 0,
            })
            .eq('id', userId);

          console.log(`Updated user ${userId} to ${tier} tier`);
        } else if (session.mode === 'payment') {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const priceId = lineItems.data[0]?.price?.id;

          if (priceId?.includes('staging_pack')) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('staging_credits_bonus')
              .eq('id', userId)
              .single();

            const currentBonus = profile?.staging_credits_bonus || 0;

            await supabase
              .from('user_profiles')
              .update({
                staging_credits_bonus: currentBonus + 10,
              })
              .eq('id', userId);

            console.log(`Added 10 staging credits to user ${userId}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          const priceId = subscription.items.data[0]?.price.id;
          const tier = mapPriceIdToTier(priceId);

          // Reset quotas when upgrading (but not when downgrading)
          const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', profile.id)
            .single();

          const shouldResetQuota = 
            currentProfile?.subscription_tier === 'free' && tier !== 'free';

          await supabase
            .from('user_profiles')
            .update({
              subscription_tier: tier,
              stripe_subscription_id: subscription.id,
              ...(shouldResetQuota && {
                generations_this_month: 0,
                staging_credits_used_this_month: 0,
                last_reset_date: new Date().toISOString(),
              }),
            })
            .eq('id', profile.id);

          console.log(`Updated subscription for user ${profile.id} to ${tier}${shouldResetQuota ? ' (quota reset)' : ''}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await supabase
            .from('user_profiles')
            .update({
              subscription_tier: 'free',
              stripe_subscription_id: null,
            })
            .eq('id', profile.id);

          console.log(`Downgraded user ${profile.id} to free tier`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function mapPriceIdToTier(priceId: string): string {
  const STARTER_PRICE_ID = process.env.STRIPE_STARTER_PRICE_ID;
  const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
  const PRO_PLUS_PRICE_ID = process.env.STRIPE_PRO_PLUS_PRICE_ID;

  if (priceId === PRO_PLUS_PRICE_ID) return 'pro_plus';
  if (priceId === PRO_PRICE_ID) return 'pro';
  if (priceId === STARTER_PRICE_ID) return 'starter';

  return 'free';
}
