import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { User } from "../types.ts";

interface AuthContextType {
  user: User | null;
  firebaseUser: any | null; // Keep for compatibility
  supabaseUser: any | null;
  token: string | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  syncUser: (token: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = async (authToken: string): Promise<User> => {
    const res = await fetch("/api/users/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to sync user with database.");
    }

    return await res.json();
  };

  useEffect(() => {
    // Check initial session
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setToken(session.access_token);
          setSupabaseUser(session.user);
          const syncedUser = await syncUser(session.access_token);
          setUser(syncedUser);
        }
      } catch (error) {
        console.error("Error checking initial session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkInitialSession();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      if (session) {
        try {
          setToken(session.access_token);
          setSupabaseUser(session.user);
          const syncedUser = await syncUser(session.access_token);
          setUser(syncedUser);
        } catch (error) {
          console.error("Error in auth state change syncing user:", error);
          setToken(null);
          setSupabaseUser(null);
          setUser(null);
        }
      } else {
        setToken(null);
        setSupabaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || "",
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setToken(null);
      setSupabaseUser(null);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser: supabaseUser, // Keep for backward compatibility
        supabaseUser,
        token,
        loading,
        loginWithEmail,
        registerWithEmail,
        logout,
        syncUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

