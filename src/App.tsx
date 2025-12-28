import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import SkipLink from './components/SkipLink';
import Landing from './pages/Landing';
import Login from './pages/Login';
import GenerateListing from './pages/GenerateListing';
import Dashboard from './pages/Dashboard';
import Pricing from './pages/Pricing';
import Account from './pages/Account';
import { Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';

function Router() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Handle OAuth callbacks and email confirmation
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Supabase automatically processes OAuth callbacks in URL hash fragments
      // and email confirmation tokens in query parameters
      
      // Check for email confirmation or password reset in URL search params
      const searchParams = new URLSearchParams(window.location.search);
      const type = searchParams.get('type');
      const token = searchParams.get('token');

      // Check for OAuth error in hash (Supabase handles success automatically)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      if (error) {
        // OAuth error - redirect to login
        console.error('OAuth error:', errorDescription || error);
        window.history.replaceState({}, '', '/login');
        setCurrentPath('/login');
        return;
      }

      // Handle email confirmation - Supabase will process this automatically
      // via onAuthStateChange, we just need to clean up the URL
      if (type === 'signup' && token) {
        // Supabase processes this automatically, just redirect to dashboard
        // The onAuthStateChange listener in AuthContext will handle the session
        window.history.replaceState({}, '', '/dashboard');
        setCurrentPath('/dashboard');
        return;
      }

      // Handle password reset
      if (type === 'recovery' && token) {
        // Redirect to login with reset flag - the Login component will handle the token
        window.history.replaceState({}, '', `/login?reset=true&token=${token}`);
        setCurrentPath('/login');
        return;
      }

      // Clean up OAuth hash fragments after Supabase processes them
      // Supabase automatically processes hash fragments on page load
      if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
        // Wait a moment for Supabase to process, then clean up
        setTimeout(() => {
          if (window.location.hash) {
            const newPath = user ? '/dashboard' : '/login';
            window.history.replaceState({}, '', newPath);
            setCurrentPath(newPath);
          }
        }, 500);
      }
    };

    handleAuthCallback();
  }, [user]);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);

    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin" aria-label="Loading application" />
      </div>
    );
  }

  if (currentPath === '/login') {
    return (
      <>
        <SkipLink targetId="login-form" children="Skip to login form" />
        <Login />
      </>
    );
  }

  if (currentPath === '/pricing') {
    return (
      <>
        <SkipLink />
        <Pricing />
      </>
    );
  }

  if (currentPath === '/account') {
    if (!user) {
      window.history.pushState({}, '', '/login');
      return <Login />;
    }
    return (
      <>
        <SkipLink />
        <Account />
      </>
    );
  }

  if (currentPath === '/dashboard') {
    if (!user) {
      window.history.pushState({}, '', '/login');
      return <Login />;
    }
    return (
      <>
        <SkipLink />
        <Dashboard />
      </>
    );
  }

  if (currentPath === '/generate') {
    return (
      <>
        <SkipLink />
        <GenerateListing />
      </>
    );
  }

  return (
    <>
      <SkipLink />
      <Landing />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
