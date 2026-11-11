import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const commerceDatabaseEnabled = import.meta.env.VITE_COMMERCE_DB_ENABLED === 'true';
const configured = Boolean(commerceDatabaseEnabled && supabaseUrl && publishableKey);

const AuthContext = createContext({
  configured,
  loading: true,
  session: null,
  user: null,
  signIn: async () => ({ error: new Error('La connexion à l’administration boutique est désactivée jusqu’à la configuration finale.') }),
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }) {
  const clientRef = useRef(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    let subscription;

    import('@supabase/supabase-js').then(async ({ createClient }) => {
      if (!active) return;
      const client = createClient(supabaseUrl, publishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
      clientRef.current = client;
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setLoading(false);
      });
      subscription = data.subscription;

      try {
        const { data: sessionData, error } = await client.auth.getSession();
        if (!active) return;
        setSession(error ? null : sessionData.session);
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setLoading(false);
      }
    }).catch(() => {
      if (active) {
        setSession(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
      clientRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({
    configured,
    loading,
    session,
    user: session?.user || null,
    async signIn(email, password) {
      if (!clientRef.current) return { error: new Error('L’administration sera disponible après application de la migration e-commerce et activation de la base.') };
      const { data, error } = await clientRef.current.auth.signInWithPassword({ email, password });
      if (data?.session) setSession(data.session);
      return { data, error };
    },
    async signOut() {
      if (!clientRef.current) return { error: null };
      const { error } = await clientRef.current.auth.signOut();
      if (!error) setSession(null);
      return { error };
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
