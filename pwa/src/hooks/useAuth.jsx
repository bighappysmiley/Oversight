import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('oversight_token');
    if (token) {
      api.me()
        .then((d) => setParent(d.parent))
        .catch(() => localStorage.removeItem('oversight_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function login(token, parentData) {
    localStorage.setItem('oversight_token', token);
    setParent(parentData);
  }

  function logout() {
    localStorage.removeItem('oversight_token');
    setParent(null);
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
