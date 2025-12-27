import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';
import { logger } from '../lib/logger';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canGenerate: () => boolean;
  canStage: () => boolean;
  getRemainingGenerations: () => number | 'unlimited';
  getRemainingStagingCredits: () => number | 'unlimited';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      logger.error('Error fetching profile:', err);
      return null;
    }
  };

  const createProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email,
          subscription_tier: 'free',
          generations_this_month: 0,
          staging_credits_used_this_month: 0,
          staging_credits_bonus: 0,
          total_stagings_generated: 0,
          billing_period_start: new Date().toISOString(),
          last_reset_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      logger.error('Error creating profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    // Check and reset quota if needed (via API)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Call API to check and reset quota
        await fetch('/api/check-quota', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }).catch(() => {
          // Silently fail - quota check is optional
        });
      }
    } catch (error) {
      logger.error('Quota check error:', error);
    }
    
    const profile = await fetchProfile(user.id);
    setProfile(profile);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          let profile = await fetchProfile(session.user.id);
          if (!profile) {
            profile = await createProfile(session.user.id, session.user.email!);
          }
          setProfile(profile);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          let profile = await fetchProfile(session.user.id);
          if (!profile) {
            profile = await createProfile(session.user.id, session.user.email!);
          }
          setProfile(profile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        if (error.message.includes('Password')) {
          throw new Error('Password must be at least 6 characters long.');
        }
        throw new Error(error.message || 'Failed to create account. Please try again.');
      }
    } catch (err) {
      logger.error('Sign up error:', err);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and confirm your account before signing in.');
        }
        throw new Error(error.message || 'Failed to sign in. Please try again.');
      }
    } catch (err) {
      logger.error('Sign in error:', err);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        throw new Error(error.message || 'Failed to sign in with Google. Please try again.');
      }
    } catch (err) {
      logger.error('Google OAuth error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Freemium enforcement helpers
  const canGenerate = (): boolean => {
    if (!profile) return false;
    const tier = profile.subscription_tier;
    if (tier === 'pro' || tier === 'pro_plus') return true; // Unlimited
    if (tier === 'free') {
      return profile.generations_this_month < 3;
    }
    if (tier === 'starter') {
      return profile.generations_this_month < 50;
    }
    return false;
  };

  const canStage = (): boolean => {
    if (!profile) return false;
    const tier = profile.subscription_tier;
    if (tier === 'free') return false;
    if (tier === 'pro_plus') return true; // Unlimited
    if (tier === 'pro') {
      return profile.staging_credits_used_this_month < 10;
    }
    if (tier === 'starter') {
      const total = 3 + (profile.staging_credits_bonus || 0);
      return profile.staging_credits_used_this_month < total;
    }
    return false;
  };

  const getRemainingGenerations = (): number | 'unlimited' => {
    if (!profile) return 0;
    const tier = profile.subscription_tier;
    if (tier === 'pro' || tier === 'pro_plus') return 'unlimited';
    if (tier === 'free') {
      return Math.max(0, 3 - profile.generations_this_month);
    }
    if (tier === 'starter') {
      return Math.max(0, 50 - profile.generations_this_month);
    }
    return 0;
  };

  const getRemainingStagingCredits = (): number | 'unlimited' => {
    if (!profile) return 0;
    const tier = profile.subscription_tier;
    if (tier === 'free') return 0;
    if (tier === 'pro_plus') return 'unlimited';
    if (tier === 'pro') {
      return Math.max(0, 10 - profile.staging_credits_used_this_month);
    }
    if (tier === 'starter') {
      const total = 3 + (profile.staging_credits_bonus || 0);
      return Math.max(0, total - profile.staging_credits_used_this_month);
    }
    return 0;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signUp, 
      signIn, 
      signInWithGoogle, 
      signOut, 
      refreshProfile,
      canGenerate,
      canStage,
      getRemainingGenerations,
      getRemainingStagingCredits,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
