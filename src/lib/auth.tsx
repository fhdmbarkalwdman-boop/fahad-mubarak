import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

type AuthValue = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** true once the profile for the current session has been fetched (or failed). */
  profileReady: boolean;
  isOwner: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setProfileFor(null);
      return;
    }
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      setProfile((data as Profile) ?? null);
    } finally {
      setProfileFor(uid);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id).catch(() => undefined);
      if (mounted) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // defer DB calls outside the auth callback (supabase-js recommendation)
      setTimeout(() => {
        loadProfile(next?.user.id).catch(() => undefined);
      }, 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      profile,
      profileReady: !session || profileFor === session.user.id,
      isOwner: profile?.role === 'owner',
      refreshProfile: () => loadProfile(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [loading, session, profile, profileFor, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
