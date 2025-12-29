import { Waves } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavigationProps {
  currentPath?: string;
}

export default function Navigation({ currentPath }: NavigationProps) {
  const { user, profile } = useAuth();
  
  const subscriptionTier = profile?.subscription_tier || 'free';
  const hasBulkAccess = ['starter', 'pro', 'pro_plus', 'team'].includes(subscriptionTier);
  const hasReportsAccess = ['pro', 'pro_plus', 'team'].includes(subscriptionTier);
  const hasTeamAccess = ['pro_plus', 'team'].includes(subscriptionTier);
  const currentTeamId = profile?.current_team_id;

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <header className="relative z-10 border-b border-gray-800/50 bg-gray-900/80 backdrop-blur-md sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 hover:opacity-80 transition"
          aria-label="Go to home page"
        >
          <Waves className="w-8 h-8 text-blue-400" />
          <span className="text-lg font-bold text-white">Lowcountry Listings AI</span>
        </button>
        
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <button
            onClick={() => navigate('/generate')}
            className={`hover:text-white transition ${
              currentPath === '/generate' ? 'text-white font-medium' : ''
            }`}
          >
            Generate
          </button>
          
          {user && (
            <button
              onClick={() => navigate('/dashboard')}
              className={`hover:text-white transition ${
                currentPath === '/dashboard' ? 'text-white font-medium' : ''
              }`}
            >
              Dashboard
            </button>
          )}
          
          {hasBulkAccess && (
            <button
              onClick={() => navigate('/bulk')}
              className={`hover:text-[#00f5ff] transition ${
                currentPath === '/bulk' ? 'text-[#00f5ff] font-medium' : ''
              }`}
            >
              Bulk
            </button>
          )}
          
          {hasReportsAccess && (
            <button
              onClick={() => navigate('/reports')}
              className={`hover:text-[#00f5ff] transition ${
                currentPath === '/reports' ? 'text-[#00f5ff] font-medium' : ''
              }`}
            >
              Reports
            </button>
          )}
          
          {user && (
            <button
              onClick={() => navigate('/analytics')}
              className={`hover:text-[#00f5ff] transition ${
                currentPath === '/analytics' ? 'text-[#00f5ff] font-medium' : ''
              }`}
            >
              Analytics
            </button>
          )}
          
          {hasTeamAccess && currentTeamId && (
            <button
              onClick={() => navigate('/team')}
              className={`hover:text-[#ff00ff] transition ${
                currentPath?.startsWith('/team') ? 'text-[#ff00ff] font-medium' : ''
              }`}
            >
              Team
            </button>
          )}
          
          <button
            onClick={() => navigate('/pricing')}
            className={`hover:text-white transition ${
              currentPath === '/pricing' ? 'text-white font-medium' : ''
            }`}
          >
            Pricing
          </button>
        </nav>
        
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-gray-300 hover:text-white transition text-sm font-medium"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/generate')}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
              >
                Generate
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition text-sm font-medium backdrop-blur-sm border border-white/20"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

