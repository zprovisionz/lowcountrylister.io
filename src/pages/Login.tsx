import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Waves, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import EmailConfirmationScreen from '../components/EmailConfirmationScreen';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        // Show email confirmation screen instead of error message
        setShowEmailConfirmation(true);
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Check if error is about email confirmation
        if (err.message.includes('Email not confirmed') || err.message.includes('confirm')) {
          setShowEmailConfirmation(true);
        } else {
          setError(err.message);
        }
      } else {
        setError('An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?reset=true`,
      });

      if (error) throw error;
      setResetEmailSent(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-gray-900"></div>
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-blue-500/10 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>

      <button
        onClick={handleBackToHome}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-300 hover:text-white transition z-10"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back to Home</span>
      </button>
      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Waves className="w-12 h-12 text-blue-400" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Lowcountry Listings AI
          </h1>
          <p className="text-gray-300">
            Hyper-local Charleston listing descriptions in seconds
          </p>
        </div>

        <div id="login-form" className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl p-8" tabIndex={-1}>
          {showEmailConfirmation ? (
            <EmailConfirmationScreen
              email={email}
              onBack={() => {
                setShowEmailConfirmation(false);
                setIsSignUp(false);
              }}
            />
          ) : showForgotPassword ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Reset Password
                </h2>
                <p className="text-gray-400 text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {resetEmailSent ? (
                <Alert variant="success" title="Reset email sent">
                  Check your email for a password reset link. Click the link to set a new password.
                </Alert>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-white placeholder-gray-500"
                      placeholder="you@example.com"
                      aria-label="Email address for password reset"
                    />
                  </div>

                  {error && <Alert variant="error">{error}</Alert>}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setError('');
                      }}
                      fullWidth
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      isLoading={loading}
                      fullWidth
                    >
                      Send Reset Link
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-white mb-6">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-white placeholder-gray-500"
                    placeholder="you@example.com"
                    aria-label="Email address"
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? 'email-error' : undefined}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-white placeholder-gray-500"
                    placeholder="••••••••"
                    aria-label="Password"
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? 'password-error' : undefined}
                  />
                  {isSignUp && <PasswordStrengthIndicator password={password} />}
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-blue-400 hover:text-blue-300 mt-2 font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                  {isSignUp && (
                    <p className="text-xs text-gray-400 mt-2">
                      Must be at least 6 characters long
                    </p>
                  )}
                </div>

                {error && (
                  <Alert variant="error" id={!isSignUp ? 'email-error password-error' : undefined}>
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  isLoading={loading}
                  fullWidth
                  size="lg"
                >
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
            </>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800/50 text-gray-400">Or continue with</span>
              </div>
            </div>

          {!showEmailConfirmation && !showForgotPassword && (
            <>
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-800/50 text-gray-400">Or continue with</span>
                  </div>
                </div>

                <Button
                  onClick={async () => {
                    setError('');
                    setLoading(true);
                    try {
                      await signInWithGoogle();
                    } catch (err: unknown) {
                      if (err instanceof Error) {
                        setError(err.message);
                      }
                      setLoading(false);
                    }
                  }}
                  isLoading={loading}
                  disabled={loading}
                  fullWidth
                  size="lg"
                  variant="secondary"
                  className="mt-4 bg-white text-gray-900 hover:bg-gray-100"
                  icon={
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  }
                  iconPosition="left"
                >
                  Continue with Google
                </Button>
              </div>
          </div>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    // Preserve email when toggling
                  }}
                  className="text-blue-400 hover:text-blue-300 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 rounded px-2 py-1"
                  aria-label={isSignUp ? 'Switch to sign in' : 'Switch to sign up'}
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Made for Charleston real estate pros</p>
        </div>
      </div>
    </div>
  );
}
