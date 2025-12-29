import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Generation } from '../lib/supabase';
import { LogOut, FileText, Calendar, MapPin, Plus, Settings, CreditCard, X, Copy, Check, Edit3, ChevronDown } from 'lucide-react';
import { NotificationContainer, NotificationType } from '../components/Notification';
import { logger } from '../lib/logger';
import { SkeletonList } from '../components/ui/Skeleton';
import Navigation from '../components/Navigation';

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type?: NotificationType;
    duration?: number;
  }>>([]);
  
  const showNotification = (message: string, type: NotificationType = 'info', duration = 5000) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    fetchGenerations();
  }, [user]);

  const fetchGenerations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      logger.error('Error fetching generations:', error);
      showNotification(
        'Failed to load your generations. Please refresh the page.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleViewFull = (generation: Generation) => {
    setSelectedGeneration(generation);
  };

  const handleCopy = async (generation: Generation) => {
    try {
      await navigator.clipboard.writeText(generation.mls_description || '');
      setCopiedId(generation.id);
      showNotification('MLS description copied to clipboard!', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      showNotification('Failed to copy to clipboard', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white relative">
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-gray-900"></div>
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-blue-500/10 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>

      <Navigation currentPath="/dashboard" />
      
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="relative flex justify-end">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800/50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            aria-label="User menu"
            aria-expanded={showMenu}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm" aria-hidden="true">
              {profile?.email.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">{profile?.email}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showMenu && (
            <div 
              className="absolute right-0 mt-2 w-56 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700/50 py-2 z-50"
              role="menu"
              aria-orientation="vertical"
            >
              <div className="px-4 py-2 border-b border-gray-700/50">
                <p className="text-xs text-gray-400">Plan</p>
                <p className="font-semibold text-white capitalize">
                  {profile?.subscription_tier === 'pro_plus' ? 'Pro+' : profile?.subscription_tier}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {profile?.generations_this_month} generations used
                </p>
              </div>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/generate');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 text-gray-300 transition text-left focus:outline-none focus:bg-gray-700/50"
                role="menuitem"
                aria-label="Create new generation"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                New Generation
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/account');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 text-gray-300 transition text-left focus:outline-none focus:bg-gray-700/50"
                role="menuitem"
                aria-label="Go to account settings"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
                Account Settings
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/pricing');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 text-gray-300 transition text-left focus:outline-none focus:bg-gray-700/50"
                role="menuitem"
                aria-label="View pricing plans"
              >
                <CreditCard className="w-4 h-4" aria-hidden="true" />
                Pricing
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 text-red-400 transition text-left focus:outline-none focus:bg-gray-700/50"
                role="menuitem"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8 md:py-12 relative z-10" tabIndex={-1}>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Your Listing History</h2>
          <p className="text-gray-300">
            View and manage all your generated listing descriptions
          </p>
        </div>

        {loading ? (
          <SkeletonList count={3} />
        ) : generations.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No listings generated yet
            </h3>
            <p className="text-gray-400 mb-6">
              Create your first Charleston listing description to get started
            </p>
            <button
              onClick={() => window.history.pushState({}, '', '/')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              <Plus className="w-5 h-5" />
              Generate Listing
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {generations.map((generation) => (
              <div
                key={generation.id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700/50 p-6 hover:bg-gray-800/70 transition"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <h3 className="font-semibold text-white text-lg">
                        {generation.address}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(generation.created_at)}
                      </span>
                      {generation.bedrooms && (
                        <span>{generation.bedrooms} bed</span>
                      )}
                      {generation.bathrooms && (
                        <span>{generation.bathrooms} bath</span>
                      )}
                      {generation.square_feet && (
                        <span>{generation.square_feet.toLocaleString()} sq ft</span>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-full border border-blue-500/30">
                    {generation.property_type}
                  </span>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <p className="text-gray-300 text-sm line-clamp-3">
                    {generation.mls_description}
                  </p>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <button
                    onClick={() => {
                      window.history.pushState({}, '', `/generate?generationId=${generation.id}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium text-sm transition"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit & Refine
                  </button>
                  <button
                    onClick={() => handleViewFull(generation)}
                    className="text-blue-400 hover:text-blue-300 font-medium text-sm transition"
                  >
                    View Full
                  </button>
                  <button
                    onClick={() => handleCopy(generation)}
                    className="flex items-center gap-1 text-gray-400 hover:text-gray-300 font-medium text-sm transition"
                  >
                    {copiedId === generation.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                  {generation.include_airbnb && (
                    <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
                      + Airbnb
                    </span>
                  )}
                  {generation.include_social && (
                    <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                      + Social
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-gray-900/50 border-t border-gray-800/50 mt-12 backdrop-blur-sm relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-6 text-sm text-gray-400">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/pricing');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="hover:text-white transition"
            >
              Pricing
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/dashboard');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="hover:text-white transition"
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/account');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="hover:text-white transition"
            >
              Account
            </button>
          </div>
          <p className="text-sm text-gray-500">Made for Charleston real estate pros</p>
        </div>
      </footer>

      {/* View Full Modal */}
      {selectedGeneration && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedGeneration.address}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {formatDate(selectedGeneration.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedGeneration(null)}
                className="text-gray-400 hover:text-white transition p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {selectedGeneration.mls_description && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">MLS/Zillow Description</h4>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {selectedGeneration.mls_description}
                    </p>
                  </div>
                </div>
              )}
              
              {selectedGeneration.airbnb_description && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Airbnb/VRBO Description</h4>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {selectedGeneration.airbnb_description}
                    </p>
                  </div>
                </div>
              )}
              
              {selectedGeneration.social_captions && Array.isArray(selectedGeneration.social_captions) && selectedGeneration.social_captions.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Social Media Captions</h4>
                  <div className="space-y-3">
                    {selectedGeneration.social_captions.map((caption: string, idx: number) => (
                      <div key={idx} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                        <p className="text-gray-200 leading-relaxed">{caption}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => handleCopy(selectedGeneration)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm font-medium"
              >
                <Copy className="w-4 h-4" />
                Copy MLS Description
              </button>
              <button
                onClick={() => setSelectedGeneration(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
