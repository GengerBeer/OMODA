import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  generations_used: number;
  generations_limit: number;
  plan: 'free' | 'pro';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        const nextProfile: UserProfile = {
          id: userId,
          email: authUser?.email ?? null,
          full_name: authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name ?? null,
          avatar_url: authUser?.user_metadata?.avatar_url ?? authUser?.user_metadata?.picture ?? null,
          generations_used: 0,
          generations_limit: 3,
          plan: 'free',
        };

        const { error: upsertError } = await supabase
          .from('user_profiles')
          .upsert(nextProfile, { onConflict: 'id' });

        if (upsertError) {
          throw upsertError;
        }

        setProfile(nextProfile);
        return;
      }

      setProfile(data as UserProfile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) {
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        void fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setLoading(true);
        void fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
  };

  const refetchProfile = useCallback(() => {
    if (user) {
      setLoading(true);
      void fetchProfile(user.id);
    }
  }, [fetchProfile, user]);

  const canUseSelfieMode = profile ? profile.generations_used < profile.generations_limit : false;
  const personalGenerationsLeft = profile
    ? Math.max(0, profile.generations_limit - profile.generations_used)
    : 0;

  return {
    user,
    profile,
    session,
    loading,
    signInWithGoogle,
    signOut,
    canUseSelfieMode,
    personalGenerationsLeft,
    refetchProfile,
  };
}
