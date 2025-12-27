import { useState, useEffect } from 'react';
import {
  User,
  CreditCard,
  BarChart3,
  ArrowLeft,
  Crown,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { NotificationContainer, NotificationType } from '../components/Notification';

const TIER_LIMITS = {
  free: { generations: 3, staging: 0, canBuyPacks: false },
  starter: { generations: 50, staging: 3, canBuyPacks: false },
  pro: { generations: -1, staging: 10, canBuyPacks: false }, // Updated: Pro gets 10/mo
  pro_plus: { generations: -1, staging: -1, canBuyPacks: true }, // Updated: Pro+ unlimited
};

const TIER_NAMES = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  pro_plus: 'Pro+',
};

export default function Account() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'billing'>('overview');
  
  const showNotification = (message: string, type: NotificationType = 'info', duration = 5000) => {
    // Notification will be handled by NotificationContainer
    const event = new CustomEvent('showNotification', {
      detail: { message, type, duration },
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const handleBackToDashboard = () => {
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleUpgrade = () => {
    window.history.pushState({}, '', '/pricing');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleManageBilling = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('Please sign in to manage billing', 'warning');
        return;
      }

      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create billing portal session');
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : 'Failed to open billing portal',
        'error'
      );
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const tierLimits = TIER_LIMITS[profile.subscription_tier];
  const tierName = TIER_NAMES[profile.subscription_tier];

  const generationsUsed = profile.generations_this_month;
  const generationsLimit = tierLimits.generations;
  const generationsRemaining =
    generationsLimit === -1 ? 'Unlimited' : generationsLimit - generationsUsed;

  const stagingUsed = profile.staging_credits_used_this_month;
  const stagingTotal = tierLimits.staging + profile.staging_credits_bonus;
  const stagingRemaining = Math.max(0, stagingTotal - stagingUsed);

  const generationsPercentage =
    generationsLimit === -1 ? 0 : (generationsUsed / generationsLimit) * 100;
  const stagingPercentage = stagingTotal > 0 ? (stagingUsed / stagingTotal) * 100 : 0;

  const nextResetDate = new Date(profile.last_reset_date);
  nextResetDate.setDate(nextResetDate.getDate() + 30);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <NotificationContainer />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-gray-900"></div>

      <div className="relative z-10">
        <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back to Dashboard</span>
              </button>

              <h1 className="text-2xl font-bold text-white">Account Settings</h1>

              <div className="w-32"></div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex gap-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-medium transition ${
                activeTab === 'overview'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-3 font-medium transition ${
                activeTab === 'billing'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Billing
              </div>
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <User className="w-8 h-8 text-blue-400" />
                    <div>
                      <h2 className="text-xl font-semibold text-white">{user.email}</h2>
                      <p className="text-sm text-gray-400">Member since {new Date(profile.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
                    {profile.subscription_tier === 'free' ? (
                      <Sparkles className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Crown className="w-5 h-5 text-blue-400" />
                    )}
                    <span className="text-white font-semibold">{tierName} Plan</span>
                  </div>
                </div>

                {profile.subscription_tier === 'free' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-blue-300 font-medium">Upgrade to unlock more features</p>
                      <p className="text-blue-300/70 text-sm mt-1">
                        Get unlimited generations and virtual staging credits
                      </p>
                      <button
                        onClick={handleUpgrade}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                      >
                        View Plans
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Listing Generations</h3>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-gray-300 text-sm">This Month</span>
                        <span className="text-2xl font-bold text-white">
                          {generationsUsed}
                          {generationsLimit !== -1 && (
                            <span className="text-gray-400 text-base font-normal"> / {generationsLimit}</span>
                          )}
                        </span>
                      </div>
                      {generationsLimit !== -1 && (
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(generationsPercentage, 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Remaining</span>
                        <span className="text-white font-semibold">{generationsRemaining}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-400">Resets on</span>
                        <span className="text-white font-semibold">{nextResetDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Virtual Staging Credits</h3>

                  {tierLimits.staging === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32">
                      <p className="text-gray-400 text-center mb-4">
                        Staging not available on {tierName} plan
                      </p>
                      <button
                        onClick={handleUpgrade}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                      >
                        Upgrade Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-baseline mb-2">
                          <span className="text-gray-300 text-sm">Used This Month</span>
                          <span className="text-2xl font-bold text-white">
                            {stagingUsed} <span className="text-gray-400 text-base font-normal">/ {stagingTotal}</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-cyan-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(stagingPercentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-700 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Monthly Credits</span>
                          <span className="text-white font-semibold">{tierLimits.staging}</span>
                        </div>
                        {profile.staging_credits_bonus > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Bonus Credits</span>
                            <span className="text-cyan-400 font-semibold">+{profile.staging_credits_bonus}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Remaining</span>
                          <span className="text-white font-semibold">{stagingRemaining}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Lifetime Stagings</span>
                          <span className="text-white font-semibold">{profile.total_stagings_generated}</span>
                        </div>
                      </div>

                      {tierLimits.canBuyPacks && (
                        <button
                          className="w-full mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-sm font-medium"
                        >
                          Buy 10 More Credits - $15
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Current Plan</h3>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg mb-6">
                  <div>
                    <p className="text-white font-semibold text-lg">{tierName} Plan</p>
                    <p className="text-gray-400 text-sm">
                      {profile.subscription_tier === 'free' ? 'No subscription' : 'Active subscription'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-2xl">
                      ${profile.subscription_tier === 'free' ? '0' : profile.subscription_tier === 'starter' ? '10' : profile.subscription_tier === 'pro' ? '19' : '29'}
                      <span className="text-gray-400 text-base font-normal">/mo</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleUpgrade}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    {profile.subscription_tier === 'free' ? 'Upgrade to Paid Plan' : 'Change Plan'}
                  </button>

                  {profile.subscription_tier !== 'free' && profile.stripe_customer_id && (
                    <button
                      onClick={handleManageBilling}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-medium"
                    >
                      Manage Billing Portal
                    </button>
                  )}
                </div>
              </div>

              {profile.subscription_tier !== 'free' && (
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Billing Information</h3>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Billing Period</span>
                      <span className="text-white">
                        {new Date(profile.billing_period_start).toLocaleDateString()} - {nextResetDate.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Next Billing Date</span>
                      <span className="text-white">{nextResetDate.toLocaleDateString()}</span>
                    </div>
                    {profile.stripe_customer_id && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Customer ID</span>
                        <span className="text-white font-mono text-xs">{profile.stripe_customer_id.substring(0, 20)}...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
