import { useState } from 'react';
import { Waves, ArrowRight, Sparkles, MapPin, FileText, Image, Clock, Zap, Check, Crown, Star, Users, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import ResultsDisplay from '../components/ResultsDisplay';
import GenerationProgress from '../components/GenerationProgress';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import StructuredData from '../components/StructuredData';
import { supabase } from '../lib/supabase';
import { apiCall, parseApiError, AppError } from '../lib/errorHandler';
import { neighborhoodService } from '../services/neighborhoodService';

export default function Landing() {
  const { user, profile, refreshProfile } = useAuth();
  const [address, setAddress] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    mls: string;
    previewSnippet?: string;
    airbnb?: string;
    social?: string[];
    confidence: 'high' | 'medium';
    generationId?: string;
    sessionId?: string;
    remainingGenerations?: number;
    isAnonymous?: boolean;
    authenticity?: {
      score: 'high' | 'medium' | 'low';
      suggestions: string[];
    };
  } | null>(null);

  const handleGetStarted = async () => {
    if (!address.trim()) return;

    setGenerating(true);
    setGenerationError(null);
    setResults(null);

    try {
      // Use anonymous endpoint if user is not authenticated
      if (!user) {
        const result = await apiCall<{
          success: boolean;
          data?: {
            id: string;
            session_id: string;
            mls_description: string;
            preview_snippet: string;
            confidence_score: number;
            confidence_level: 'high' | 'medium';
            remaining_generations: number;
          };
          error?: string;
          code?: string;
          count?: number;
          remaining?: number;
        }>(
          '/api/generate-anonymous',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address: address.trim(),
              property_type: 'single_family',
              amenities: [],
              photo_urls: [],
              include_airbnb: false,
              include_social: false,
            }),
          },
          2
        );

        if (!result.success || !result.data) {
          // Check if rate limit exceeded
          if (result.code === 'RATE_LIMIT_EXCEEDED') {
            setGenerationError('You\'ve reached the limit of 3 free generations. Sign up for unlimited access!');
            // Show sign-up prompt
            setTimeout(() => {
              window.history.pushState({}, '', '/login');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }, 2000);
            return;
          }
          // Check for migration error
          if (result.code === 'MIGRATION_REQUIRED') {
            setGenerationError('Service is being updated. Please try again in a few moments.');
            return;
          }
          // Provide user-friendly error messages
          const errorMessage = result.error || 'Failed to generate listing. Please try again.';
          throw new Error(errorMessage);
        }

        // Calculate authenticity for display
        const authenticity = neighborhoodService.calculateCharlestonAuthenticity(result.data.mls_description);

        setResults({
          mls: result.data.mls_description, // Full description stored but will show preview
          previewSnippet: result.data.preview_snippet, // Preview snippet for display
          airbnb: undefined,
          social: undefined,
          confidence: result.data.confidence_level || 'medium',
          generationId: result.data.id,
          sessionId: result.data.session_id,
          remainingGenerations: result.data.remaining_generations,
          isAnonymous: true,
          authenticity: {
            score: authenticity.score,
            suggestions: authenticity.suggestions,
          },
        });

        // Scroll to results
        setTimeout(() => {
          const resultsElement = document.getElementById('generation-results');
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
        return;
      }

      // Authenticated user flow - check quota
      const generationsRemaining = profile
        ? profile.subscription_tier === 'free'
          ? 3 - profile.generations_this_month
          : profile.subscription_tier === 'starter'
          ? 50 - profile.generations_this_month
          : Infinity
        : Infinity;

      if (generationsRemaining <= 0) {
        window.history.pushState({ address }, '', '/generate');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the authenticated API
      const result = await apiCall<{
        success: boolean;
        data?: {
          id: string;
          mls_description: string;
          airbnb_description?: string;
          social_captions?: string[];
          confidence_level: 'high' | 'medium';
        };
        error?: string;
        code?: string;
      }>(
        '/api/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            address: address.trim(),
            property_type: 'single_family',
            amenities: [],
            photo_urls: [],
            include_airbnb: false,
            include_social: false,
          }),
        },
        2
      );

      if (!result.success || !result.data) {
        throw new Error('Invalid response from server');
      }

      // Calculate authenticity for display
      const authenticity = neighborhoodService.calculateCharlestonAuthenticity(result.data.mls_description);

      setResults({
        mls: result.data.mls_description,
        airbnb: result.data.airbnb_description || undefined,
        social: result.data.social_captions || undefined,
        confidence: result.data.confidence_level || 'medium',
        generationId: result.data.id,
        isAnonymous: false,
        authenticity: {
          score: authenticity.score,
          suggestions: authenticity.suggestions,
        },
      });

      await refreshProfile();

      // Scroll to results
      setTimeout(() => {
        const resultsElement = document.getElementById('generation-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error) {
      const parsedError = parseApiError(error);
      
      if (error instanceof AppError && error.code === 'QUOTA_EXCEEDED') {
        setGenerationError('You\'ve reached your monthly generation limit. Please upgrade to continue.');
        window.history.pushState({ address }, '', '/generate');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }
      
      setGenerationError(parsedError.message || 'Failed to generate listing. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCustomizeRegenerate = () => {
    if (address.trim()) {
      window.history.pushState({ address }, '', '/generate');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleSaveToHistory = () => {
    // Generation is already saved automatically in /api/generate
    if (user) {
      window.history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      handleSignIn();
    }
  };

  const handleSignIn = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleDashboard = () => {
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handlePricing = () => {
    window.history.pushState({}, '', '/pricing');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleVirtualStaging = () => {
    if (user && (profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'pro_plus')) {
      window.history.pushState({}, '', '/generate?mode=staging');
    } else {
      window.history.pushState({}, '', '/pricing');
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <>
      <StructuredData type="LocalBusiness" />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-gray-900"></div>
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-blue-500/10 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>

      <header className="relative z-10 border-b border-gray-800/50 bg-gray-900/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Waves className="w-8 h-8 text-blue-400" />
            <span className="text-lg font-bold text-white">Lowcountry Listings AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-300">
            <a href="#features" className="hover:text-white transition">Features</a>
            <button onClick={handleVirtualStaging} className="hover:text-white transition">Virtual Staging</button>
            <button onClick={handlePricing} className="hover:text-white transition">Pricing</button>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button onClick={handleDashboard} className="px-4 py-2 text-gray-300 hover:text-white transition text-sm font-medium">
                  Dashboard
                </button>
                <button
                  onClick={() => { window.history.pushState({}, '', '/generate'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
                >
                  Generate
                </button>
              </>
            ) : (
              <button onClick={handleSignIn} className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition text-sm font-medium backdrop-blur-sm border border-white/20">
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-10" tabIndex={-1}>
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-300 text-sm font-medium backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            AI powered; built for the Lowcountry
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">
            Create listing descriptions<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">that sell homes faster</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-300 mb-4 max-w-2xl mx-auto leading-relaxed">
            Generate MLS descriptions, Airbnb listings, and social captions with hyper-local Charleston insights in seconds.
          </p>

          <p className="text-sm text-gray-400 mb-10">
            Try free - no credit card required
          </p>

          <div className="max-w-2xl mx-auto mb-10">
            <div className="relative bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-2 shadow-2xl shadow-blue-500/5">
              <div className="flex items-center gap-2 bg-gray-900/60 rounded-xl px-4 py-3">
                <div className="flex-1">
                  <AddressAutocompleteInput
                    value={address}
                    onChange={setAddress}
                    placeholder="Enter a Charleston address..."
                    autoFocus
                    inputClassName="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-base sm:text-lg focus:ring-0 pl-12"
                    className="flex-1"
                  />
                </div>
                <Button
                  onClick={handleGetStarted}
                  disabled={!address.trim() || generating}
                  isLoading={generating}
                  icon={!generating && <ArrowRight className="w-5 h-5" />}
                  iconPosition="right"
                  className="whitespace-nowrap shadow-lg shadow-blue-600/20"
                  aria-label="Generate listing description"
                >
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>50+ agents</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span>4.9 rating</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-400" />
              <span>45 min saved per listing</span>
            </div>
          </div>
        </section>

          {/* Generation Results Section */}
        {(generating || results || generationError) && (
          <section id="generation-results" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {generating && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 p-12">
                <div className="text-center mb-8">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" aria-hidden="true" />
                  <h3 className="text-xl font-semibold text-white mb-2">Generating your listing description...</h3>
                  <p className="text-gray-400">Using neighborhood intelligence and Charleston-specific insights</p>
                </div>
                <GenerationProgress
                  currentStep="Generating"
                  steps={[
                    { label: 'Analyzing', description: 'Processing address and neighborhood' },
                    { label: 'Generating', description: 'Creating listing description' },
                    { label: 'Reviewing', description: 'Quality checking' },
                  ]}
                />
                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-400">This usually takes 30-60 seconds</p>
                </div>
              </div>
            )}

            {generationError && (
              <Alert
                variant="error"
                title="Generation Failed"
              >
                <div className="space-y-4">
                  <p>{generationError}</p>
                  <Button
                    onClick={handleCustomizeRegenerate}
                    size="sm"
                  >
                    Try Advanced Options
                  </Button>
                </div>
              </Alert>
            )}

            {results && (
              <div className="space-y-6">
                <ResultsDisplay
                  mlsDescription={results.mls}
                  previewSnippet={results.previewSnippet}
                  isAnonymous={results.isAnonymous}
                  remainingGenerations={results.remainingGenerations}
                  airbnbDescription={results.airbnb}
                  socialCaptions={results.social}
                  confidenceLevel={results.confidence}
                  onSave={handleSaveToHistory}
                  authenticity={results.authenticity}
                  photos={[]}
                  generationId={results.generationId}
                  onUpgradeClick={handlePricing}
                  subscriptionTier={profile?.subscription_tier || 'free'}
                />
                
                <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                      <h3 className="text-xl font-bold text-white mb-2">Want more control?</h3>
                      <p className="text-gray-300 text-sm">
                        Add property details, photos, amenities, and generate Airbnb or social media descriptions
                      </p>
                    </div>
                <Button
                  onClick={handleCustomizeRegenerate}
                  icon={<Settings className="w-5 h-5" />}
                  iconPosition="left"
                  aria-label="Customize listing and regenerate"
                >
                  Customize & Regenerate
                </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for Charleston real estate</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Every feature designed specifically for Lowcountry agents and property managers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 hover:border-gray-600/50 transition group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition">
                <MapPin className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3">Neighborhood Intelligence</h3>
              <p className="text-gray-400 leading-relaxed">
                Our AI knows Downtown's historic charm, Mount Pleasant's family appeal, and everything in between. Descriptions include real landmarks, schools, and local hotspots.
              </p>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 hover:border-gray-600/50 transition group">
              <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition">
                <FileText className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3">Multiple Formats</h3>
              <p className="text-gray-400 leading-relaxed">
                Generate MLS-ready descriptions, Airbnb listings optimized for bookings, and social media captions - all tailored to each platform's best practices.
              </p>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 hover:border-gray-600/50 transition group">
              <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition">
                <Zap className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3">Instant Results</h3>
              <p className="text-gray-400 leading-relaxed">
                Go from property details to polished description in under 30 seconds. Upload photos for AI analysis that captures every selling point automatically.
              </p>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 hover:border-gray-600/50 transition group">
              <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-amber-500/20 transition">
                <Clock className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3">Generation History</h3>
              <p className="text-gray-400 leading-relaxed">
                Every listing saved to your dashboard. Revisit, edit, and reuse previous generations. Track your entire portfolio in one place.
              </p>
            </div>
          </div>
        </section>

        <section id="staging" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-gradient-to-br from-amber-600/10 via-orange-600/5 to-transparent backdrop-blur-sm border border-amber-500/20 rounded-3xl p-8 md:p-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>

            <div className="grid md:grid-cols-2 gap-10 items-center relative">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-300 text-sm font-semibold mb-6">
                  <Image className="w-4 h-4" />
                  Pro Feature
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
                  Virtual Staging<br />
                  <span className="text-amber-400">that sells homes</span>
                </h2>
                <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                  Transform empty rooms into beautifully furnished spaces using AI. Choose from coastal modern, lowcountry traditional, minimalist, and contemporary styles.
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-gray-300">Ready in 60-90 seconds</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-gray-300">Photorealistic furniture placement</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-gray-300">Staged listings sell 73% faster</span>
                  </div>
                </div>

                <button onClick={handlePricing} className="px-8 py-4 bg-amber-600 hover:bg-amber-700 rounded-xl font-semibold transition shadow-lg shadow-amber-600/20 flex items-center gap-2">
                  See Staging Plans
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Before</div>
                    <div className="aspect-[4/3] bg-gray-700/50 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-600/50 rounded-lg mx-auto mb-2"></div>
                        <span className="text-gray-500 text-sm">Empty Room</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-800/80 rounded-xl p-4 border border-amber-500/30">
                    <div className="text-xs text-amber-400 mb-3 font-medium uppercase tracking-wider">After</div>
                    <div className="aspect-[4/3] bg-gradient-to-br from-amber-600/20 to-orange-600/10 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-amber-500/20 rounded-lg mx-auto mb-2 border border-amber-500/30"></div>
                        <span className="text-amber-300 text-sm">Staged</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <span className="text-sm text-gray-500">4 design styles available</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-lg">Start free, upgrade when you need more</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8">
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$0</span>
                </div>
                <p className="text-gray-500 text-sm mt-1">Perfect to try it out</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  3 generations per month
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  MLS format
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  Neighborhood insights
                </li>
              </ul>
              <button onClick={user ? handleDashboard : handleSignIn} className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition">
                {user ? 'Go to Dashboard' : 'Get Started'}
              </button>
            </div>

            <div className="bg-gradient-to-b from-blue-600/20 to-blue-600/5 backdrop-blur-sm border-2 border-blue-500 rounded-2xl p-8 relative scale-[1.02] shadow-xl shadow-blue-500/10">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">Most Popular</span>
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$19</span>
                  <span className="text-gray-400">/mo</span>
                </div>
                <p className="text-gray-400 text-sm mt-1">For active agents</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  Unlimited generations
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  All formats (MLS, Airbnb, Social)
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  15 staging credits/month
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  Priority support
                </li>
              </ul>
              <button onClick={handlePricing} className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition shadow-lg shadow-blue-600/20">
                Start Free Trial
              </button>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-xl font-bold">Pro+</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$29</span>
                  <span className="text-gray-400">/mo</span>
                </div>
                <p className="text-gray-500 text-sm mt-1">High-volume teams</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  Everything in Pro
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  50 staging credits/month
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  Buy additional credits
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  Dedicated support
                </li>
              </ul>
              <button onClick={handlePricing} className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition">
                Get Pro+
              </button>
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm mt-8">
            All paid plans include a 7-day free trial. Cancel anytime.
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Trusted by Charleston agents</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                "The neighborhood descriptions are spot-on. It actually knows about West Ashley schools and James Island amenities. Saves me 30 minutes per listing."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-lg">
                  SM
                </div>
                <div>
                  <div className="text-white font-semibold">Sarah Mitchell</div>
                  <div className="text-gray-500 text-sm">Carolina One Real Estate</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                "Virtual staging is a game-changer for vacant properties. Pro plan pays for itself with just one faster sale. Worth every penny."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold text-lg">
                  JR
                </div>
                <div>
                  <div className="text-white font-semibold">James Rodriguez</div>
                  <div className="text-gray-500 text-sm">Dunes Properties</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                "Finally, AI that doesn't sound like a robot wrote it. The descriptions feel authentic and actually mention real Charleston landmarks."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 font-bold text-lg">
                  EP
                </div>
                <div>
                  <div className="text-white font-semibold">Emily Patterson</div>
                  <div className="text-gray-500 text-sm">Kiawah Island Real Estate</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 backdrop-blur-sm border border-blue-500/20 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to save 45 minutes per listing?
              </h2>
              <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto">
                Join 200+ Charleston agents using AI to create compelling property descriptions.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={user ? handleDashboard : handleSignIn}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  {user ? 'Go to Dashboard' : 'Start Free'}
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button onClick={handlePricing} className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition border border-white/20">
                  View Pricing
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 mt-8 text-sm text-gray-400">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Downtown Charleston
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Mount Pleasant
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  West Ashley
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  James Island
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Folly Beach
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-gray-800/50 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Waves className="w-6 h-6 text-blue-400" />
              <span className="text-gray-400">Lowcountry Listings AI</span>
            </div>
            <div className="flex gap-8 text-sm text-gray-400">
              <a href="#features" className="hover:text-white transition">Features</a>
              <button onClick={handleVirtualStaging} className="hover:text-white transition">Virtual Staging</button>
              <button onClick={handlePricing} className="hover:text-white transition">Pricing</button>
              <a href="mailto:support@lowcountrylistings.ai" className="hover:text-white transition">Support</a>
            </div>
          </div>
          <div className="border-t border-gray-800/50 mt-8 pt-8 text-center text-sm text-gray-500">
            Made for Charleston real estate professionals
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
