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

function Router() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

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
