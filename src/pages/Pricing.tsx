import { useState } from 'react';
import { Check, Sparkles, Zap, Crown, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

interface PricingTier {
  name: string;
  price: number;
  tier: 'free' | 'starter' | 'pro' | 'pro_plus';
  generations: string;
  stagingCredits: number;
  features: string[];
  cta: string;
  popular?: boolean;
  icon: React.ElementType;
  priceId?: string;
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: 0,
    tier: 'free',
    generations: '3 per month',
    stagingCredits: 0,
    features: [
      '3 listing descriptions per month',
      'MLS format included',
      'Basic property features',
      'No virtual staging',
      'Community support',
    ],
    cta: 'Get Started',
    icon: Sparkles,
  },
  {
    name: 'Starter',
    price: 10,
    tier: 'starter',
    generations: '50 per month',
    stagingCredits: 3,
    features: [
      '50 listing descriptions per month',
      'MLS + Airbnb formats',
      'Social media captions',
      '3 virtual staging credits',
      'AI photo analysis',
      'Email support',
    ],
    cta: 'Start Free Trial',
    icon: Zap,
    priceId: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID,
  },
  {
    name: 'Pro',
    price: 19,
    tier: 'pro',
    generations: 'Unlimited',
    stagingCredits: 15,
    features: [
      'Unlimited listing descriptions',
      'All formats included',
      '15 virtual staging credits per month',
      'Advanced AI photo analysis',
      'Neighborhood insights',
      'Priority email support',
      'Download history',
    ],
    cta: 'Go Pro',
    icon: Crown,
    popular: true,
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
  },
  {
    name: 'Pro+',
    price: 29,
    tier: 'pro_plus',
    generations: 'Unlimited',
    stagingCredits: 50,
    features: [
      'Everything in Pro',
      '50 virtual staging credits per month',
      'Purchase additional staging packs',
      'White-glove onboarding',
      'Dedicated account manager',
      'Priority phone support',
      'API access (coming soon)',
    ],
    cta: 'Get Pro+',
    icon: Crown,
    priceId: import.meta.env.VITE_STRIPE_PRO_PLUS_PRICE_ID,
  },
];

export default function Pricing() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubscribe = async (tier: PricingTier) => {
    if (!user) {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }

    if (tier.tier === 'free') {
      return;
    }

    if (!tier.priceId) {
      setError('Pricing not configured. Please contact support.');
      return;
    }

    setLoading(tier.tier);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = import.meta.env.VITE_API_URL || '';

      const response = await fetch(`${apiUrl}/api/stripe/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          price_id: tier.priceId,
          success_url: `${window.location.origin}/dashboard?checkout=success`,
          cancel_url: `${window.location.origin}/pricing?checkout=cancel`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { data } = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      logger.error('Checkout error:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to start checkout. Please try again or contact support.';
      setError(errorMessage);
      setLoading(null);
    }
  };

  const handleBackToHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const currentTier = profile?.subscription_tier || 'free';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-gray-900"></div>

      <button
        onClick={handleBackToHome}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-300 hover:text-white transition z-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg px-2 py-1"
        aria-label="Go back to home page"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        <span className="text-sm font-medium">Back to Home</span>
      </button>

      <main id="main-content" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" tabIndex={-1}>
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Generate professional listing descriptions with hyper-local Charleston insights.
            Upgrade anytime for virtual staging and unlimited generations.
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isCurrentPlan = currentTier === tier.tier;

            return (
              <div
                key={tier.tier}
                className={`relative bg-gray-800/50 backdrop-blur-sm border rounded-2xl p-8 transition-all ${
                  tier.popular
                    ? 'border-blue-500 shadow-2xl shadow-blue-500/20 scale-105'
                    : 'border-gray-700/50 hover:border-gray-600'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <Icon className={`w-8 h-8 ${tier.popular ? 'text-blue-400' : 'text-gray-400'}`} />
                  <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">${tier.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="text-sm">
                    <span className="text-gray-400">Generations: </span>
                    <span className="text-white font-semibold">{tier.generations}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Staging Credits: </span>
                    <span className="text-white font-semibold">
                      {tier.stagingCredits === 0 ? 'None' : `${tier.stagingCredits}/month`}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(tier)}
                  disabled={loading !== null || isCurrentPlan}
                  isLoading={loading === tier.tier}
                  variant={tier.popular ? 'primary' : 'secondary'}
                  fullWidth
                  size="lg"
                  aria-label={isCurrentPlan ? `Current plan: ${tier.name}` : `Subscribe to ${tier.name} plan`}
                >
                  {isCurrentPlan ? 'Current Plan' : tier.cta}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What is virtual staging?
              </h3>
              <p className="text-gray-300">
                Virtual staging uses AI to furnish and decorate empty room photos, making properties
                more appealing to buyers. Our staging features coastal modern, lowcountry traditional,
                and other styles perfect for Charleston properties.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                How long does staging take?
              </h3>
              <p className="text-gray-300">
                Most staging requests complete in 60-90 seconds. You'll see a before/after comparison
                and can download high-resolution images for your listings.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I purchase additional staging credits?
              </h3>
              <p className="text-gray-300">
                Yes! Pro+ subscribers can purchase staging packs: 10 additional credits for $15.
                Perfect for active agents with high listing volume.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What makes your descriptions "hyper-local"?
              </h3>
              <p className="text-gray-300">
                We've trained our AI on Charleston's unique neighborhoods, landmarks, and real estate
                vocabulary. Descriptions include actual drive times to downtown, reference local
                amenities, and use authentic Charleston terminology.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-300">
                Yes, all plans can be canceled anytime from your account settings. You'll retain
                access until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
