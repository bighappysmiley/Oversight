import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import { firebaseLogin, firebaseRegister, isFirebaseConfigured } from '../lib/firebase';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (isFirebaseConfigured) {
        data = mode === 'login'
          ? await firebaseLogin(email, password)
          : await firebaseRegister(email, password, name);
      } else {
        data = mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password, name);
      }
      login(data.token, data.parent);
      navigate('/');
    } catch (err) {
      // Translate Firebase error codes to friendly messages
      const msg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Invalid email or password'
        : err.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists'
        : err.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters'
        : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <Icon name="eye" size={48} color="#4f46e5" />
          <h1 style={styles.title}>Oversight</h1>
          <p style={styles.subtitle}>Parental controls for your family's devices</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280', letterSpacing: 1 }}>BY BIGHAPPYSMILEY</p>
        </div>

        <div style={styles.tabs}>
          <button
            onClick={() => setMode('login')}
            style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('register')}
            style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <label style={styles.label}>
              Your name
              <input
                style={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </label>
          )}
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : ''}
              required
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 28,
  },
  title: { margin: '8px 0 4px', fontSize: 28, fontWeight: 700, color: '#1e1b4b' },
  subtitle: { margin: 0, color: '#6b7280', fontSize: 14 },
  tabs: {
    display: 'flex',
    background: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    border: 'none',
    background: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    color: '#6b7280',
  },
  tabActive: { background: '#fff', color: '#1e1b4b', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: '#374151' },
  input: {
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
  },
  error: { margin: 0, color: '#ef4444', fontSize: 13, background: '#fef2f2', padding: '8px 12px', borderRadius: 6 },
  btn: {
    padding: '12px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
};
