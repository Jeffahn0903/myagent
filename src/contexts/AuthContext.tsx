'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  hasGoogleAuth: boolean;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (authToken?: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch('/api/me', { headers });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setTokenState(null);
        setUser(null);
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Failed to fetch user', error);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setTokenState(storedToken);
      fetchUser(storedToken).finally(() => setLoading(false));
    } else {
      // Fallback: check cookie auth via /api/me
      fetchUser(null).finally(() => setLoading(false));
    }
  }, [fetchUser]);

  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('authToken', newToken);
      fetchUser(newToken);
    } else {
      setUser(null);
      localStorage.removeItem('authToken');
    }
  }, [fetchUser]);

  const logout = useCallback(() => {
    setToken(null);
  }, [setToken]);

  return (
    <AuthContext.Provider value={{ token, user, loading, setToken, logout }}>
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
