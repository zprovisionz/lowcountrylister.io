import { useState, useEffect, useRef } from 'react';
import { Waves, ArrowRight, Sparkles, MapPin, FileText, Image, Clock, Zap, Check, Crown, Star, Users, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import ResultsDisplay from '../components/ResultsDisplay';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import StructuredData from '../components/StructuredData';
import Navigation from '../components/Navigation';
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

  // Refs for auto-generation
  const previousAddress = useRef<string>('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleGenerate = async () => {
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
          console.error('Generation error details:', result);
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
    // Store generationId in sessionStorage before redirecting to login
    if (results?.generationId) {
      sessionStorage.setItem('pendingGenerationId', results.generationId);
    }
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Reset results when address changes significantly
  useEffect(() => {
    if (address !== previousAddress.current && previousAddress.current !== '') {
      setResults(null);
      setGenerationError(null);
    }
    previousAddress.current = address;
  }, [address]);

  // Auto-generate when a valid Charleston address is detected
  useEffect(() => {
    const trimmed = address.trim();
    const isValid = trimmed.length > 30 && (
      trimmed.toLowerCase().includes('charleston') ||
      trimmed.toLowerCase().includes(', sc') ||
      trimmed.toLowerCase().includes('south carolina')
    );

    if (isValid && !generating && !results) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        handleGenerate();
      }, 600);

      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }
  }, [address, generating, results]);

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

      <Navigation currentPath="/" />

      <main id="main-content" className="relative z-10" tabIndex={-1}>
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-8 text-center">
          {/* AI Badge with pulse animation */}
          <div className="mb-4 animate-fadeInDown">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-300 text-sm font-medium backdrop-blur-sm badge-pulse">
              <Sparkles className="w-4 h-4 animate-pulse" />
              AI powered; built for the Lowcountry
            </div>
          </div>

          {/* Stats row directly under AI badge */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400 mb-5 animate-fadeIn delay-100">
            <div className="flex items-center gap-2 glass-light px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4 text-blue-400" />
              <span>50+ agents</span>
            </div>
            <div className="flex items-center gap-2 glass-light px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span>4.9 rating</span>
            </div>
            <div className="flex items-center gap-2 glass-light px-3 py-1.5 rounded-full">
              <Clock className="w-4 h-4 text-green-400" />
              <span>45 min saved</span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight tracking-tight animate-fadeInUp delay-150">
            Create listing descriptions{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              that sell homes faster
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-300 mb-3 max-w-2xl mx-auto leading-relaxed animate-fadeIn delay-200">
            Generate MLS descriptions, Airbnb listings, and social captions with hyper-local Charleston insights in seconds.
          </p>

          <p className="text-sm text-gray-400 mb-6 animate-fadeIn delay-300">
            <Check className="w-4 h-4 inline mr-1 text-green-400" />
            Try free - no credit card required
          </p>

          {/* Search input with enhanced styling */}
          <div className="max-w-2xl mx-auto animate-fadeInUp delay-400">
            <div className={`relative bg-gray-800/60 backdrop-blur-md border rounded-2xl p-2 shadow-2xl transition-all duration-300 ${
              generating ? 'border-blue-500/50 shadow-blue-500/20 animate-pulse-glow' : 'border-gray-700/50 shadow-blue-500/5 hover:border-gray-600/50'
            }`}>
              <div className="flex items-center gap-2 bg-gray-900/60 rounded-xl px-4 py-3">
                <div className="flex-1">
                  <AddressAutocompleteInput
                    value={address}
                    onChange={setAddress}
                    placeholder="Enter a Charleston address..."
                    autoFocus
                    inputClassName="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-base sm:text-lg focus:ring-0 pl-12 input-glow"
                    className="flex-1"
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!address.trim() || generating}
                  isLoading={generating}
                  icon={!generating && <ArrowRight className="w-5 h-5" />}
                  iconPosition="right"
                  className={`whitespace-nowrap shadow-lg shadow-blue-600/20 btn-glow btn-ripple ${generating ? '' : 'hover:shadow-blue-600/40'}`}
                  aria-label="Generate listing description"
                >
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
            
            {/* Typing hint when empty */}
            {!address && !generating && !results && (
              <p className="text-xs text-gray-500 mt-3 animate-fadeIn">
                💡 Start typing an address to auto-generate
              </p>
            )}
          </div>
        </section>

          {/* Generation Results Section */}
        {(generating || results || generationError) && (
          <section id="generation-results" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {generating && (
              <div className="glass rounded-2xl shadow-2xl p-8 sm:p-12 animate-scaleIn">
                <div className="text-center mb-8">
                  <div className="relative inline-block">
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-400" aria-hidden="true" />
                    </div>
                    <div className="absolute inset-0 animate-ping opacity-30">
                      <div className="w-16 h-16 rounded-full bg-blue-500/30 mx-auto" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Generating your listing...</h3>
                  <p className="text-gray-400 text-sm">Analyzing neighborhood & crafting description</p>
                </div>
                
                {/* Simplified progress */}
                <div className="max-w-md mx-auto">
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ '--progress': '70%' } as React.CSSProperties} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span className="text-blue-400">Analyzing</span>
                    <span>Generating</span>
                    <span>Done</span>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 text-center mt-6">Usually takes 15-30 seconds</p>
              </div>
            )}

            {generationError && (
              <div className="animate-shake">
                <Alert
                  variant="error"
                  title="Generation Failed"
                >
                  <div className="space-y-4">
                    <p>{generationError}</p>
                    <Button
                      onClick={handleCustomizeRegenerate}
                      size="sm"
                      className="btn-ripple"
                    >
                      Try Advanced Options
                    </Button>
                  </div>
                </Alert>
              </div>
            )}

            {results && (
              <div className="space-y-6 animate-fadeInUp">
                {/* Success indicator */}
                <div className="flex items-center justify-center gap-2 text-green-400 text-sm mb-4 animate-success">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Description generated successfully!</span>
                </div>
                
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
                
                {/* CTA Card with hover effect */}
                <div className="card-hover bg-gradient-to-r from-blue-600/20 to-cyan-600/20 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                      <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        Want more control?
                      </h3>
                      <p className="text-gray-300 text-sm">
                        Add photos, amenities, and generate Airbnb or social media descriptions
                      </p>
                    </div>
                    <Button
                      onClick={handleCustomizeRegenerate}
                      icon={<ArrowRight className="w-5 h-5" />}
                      iconPosition="right"
                      className="btn-glow btn-ripple whitespace-nowrap"
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

        <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for Charleston real estate</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Every feature designed specifically for Lowcountry agents and property managers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-hover glass rounded-2xl p-8 group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all duration-300">
                <MapPin className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3 group-hover:text-blue-300 transition">Neighborhood Intelligence</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Our AI knows Downtown's historic charm, Mount Pleasant's family appeal, and everything in between. Real landmarks, schools, and local hotspots.
              </p>
            </div>

            <div className="card-hover glass rounded-2xl p-8 group">
              <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all duration-300">
                <FileText className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3 group-hover:text-cyan-300 transition">Multiple Formats</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Generate MLS-ready descriptions, Airbnb listings optimized for bookings, and social media captions - all platform-optimized.
              </p>
            </div>

            <div className="card-hover glass rounded-2xl p-8 group">
              <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-500/20 group-hover:scale-110 transition-all duration-300">
                <Zap className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3 group-hover:text-green-300 transition">Instant Results</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Go from address to polished description in under 30 seconds. Upload photos for AI analysis that captures every selling point.
              </p>
            </div>

            <div className="card-hover glass rounded-2xl p-8 group">
              <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all duration-300">
                <Image className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="font-semibold text-xl mb-3 group-hover:text-amber-300 transition">Photo Analysis</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Upload property photos and our AI extracts features automatically - hardwood floors, granite counters, natural light, and more.
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

                <div className="space-y-4">
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
