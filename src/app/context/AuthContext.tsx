import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
  userId: string | null;
  isLoading: boolean;
  // sessionKey changes whenever the user changes, forcing Outlet remount
  sessionKey: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionKey, setSessionKey] = useState('');

  useEffect(() => {
    // Check initial auth state
    async function getInitialUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUserId(data.user.id);
        setSessionKey(data.user.id);
      } else {
        setUserId(null);
        setSessionKey('anon-' + Math.random());
      }
      setIsLoading(false);
    }

    getInitialUser();

    // Listen for auth state changes (login, logout, etc)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // whenever auth state changes, update userId and sessionKey
      // this forces any component using sessionKey to remount
      if (session?.user) {
        setUserId(session.user.id);
        // Use user id as key so it changes on every login
        setSessionKey(session.user.id);
      } else {
        setUserId(null);
        // Use a unique key for logged-out state
        setSessionKey('anon-' + Date.now());
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ userId, isLoading, sessionKey }}>
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
