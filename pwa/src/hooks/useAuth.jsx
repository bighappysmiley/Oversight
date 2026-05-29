import { createContext, useContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged, firebaseLogout, isFirebaseConfigured } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // No Firebase config — restore any stored session from JWT login
      const stored = localStorage.getItem('oversight_parent');
      if (stored) {
        try { setParent(JSON.parse(stored)); } catch {}
      }
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const p = {
          id: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
        };
        setParent(p);
        localStorage.setItem('oversight_parent', JSON.stringify(p));
        // Store fresh ID token so backend API calls can use it
        user.getIdToken().then((t) => localStorage.setItem('oversight_token', t));
      } else {
        setParent(null);
        localStorage.removeItem('oversight_parent');
        localStorage.removeItem('oversight_token');
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Called by Login page for both Firebase and fallback JWT flows
  function login(token, parentData) {
    localStorage.setItem('oversight_token', token);
    localStorage.setItem('oversight_parent', JSON.stringify(parentData));
    setParent(parentData);
  }

  async function logout() {
    localStorage.removeItem('oversight_token');
    localStorage.removeItem('oversight_parent');
    setParent(null);
    if (isFirebaseConfigured) await firebaseLogout();
  }

  return (
    <AuthContext.Provider value={{ parent, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
