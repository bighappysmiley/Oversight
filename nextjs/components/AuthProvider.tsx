'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged, firebaseLogout } from '@/lib/firebase';

interface Parent {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  parent: Parent | null;
  loading: boolean;
  login: (token: string, parentData: Parent) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const p: Parent = {
          id: user.uid,
          email: user.email!,
          name: user.displayName || user.email!.split('@')[0],
        };
        setParent(p);
        localStorage.setItem('oversight_parent', JSON.stringify(p));
        user.getIdToken().then((t) => localStorage.setItem('oversight_token', t));
      } else {
        // Try stored session
        const stored = localStorage.getItem('oversight_parent');
        if (stored) {
          try { setParent(JSON.parse(stored)); } catch {}
        } else {
          setParent(null);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function login(token: string, parentData: Parent) {
    localStorage.setItem('oversight_token', token);
    localStorage.setItem('oversight_parent', JSON.stringify(parentData));
    setParent(parentData);
  }

  async function logout() {
    localStorage.removeItem('oversight_token');
    localStorage.removeItem('oversight_parent');
    setParent(null);
    try { await firebaseLogout(); } catch {}
  }

  return (
    <AuthContext.Provider value={{ parent, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
