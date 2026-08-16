"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Channel } from "@/lib/supabase";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  channel: Channel | null;
  loading: boolean;
  refreshChannel: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  channel: null,
  loading: true,
  refreshChannel: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChannel = async (userId: string) => {
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setChannel(data as Channel | null);
  };

  const refreshChannel = async () => {
    if (user) {
      await fetchChannel(user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchChannel(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        (async () => {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          if (newSession?.user) {
            await fetchChannel(newSession.user.id);
          } else {
            setChannel(null);
          }
          setLoading(false);
        })();
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setChannel(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, channel, loading, refreshChannel, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
