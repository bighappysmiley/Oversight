import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function AddDevice() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [deviceName, setDeviceName] = useState('');
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  async function generate(e) {
    e.preventDefault();
    if (!deviceName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.generatePairCode(deviceName.trim());
      setCode(data.code);
      setExpiresAt(data.expires_at);
      const secondsLeft = data.expires_at - Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, secondsLeft));
      setStep(2);

      // Countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            clearInterval(pollRef.current);
            setError('Pairing code expired. Please start over.');
            setStep(1);
            return 0;
          }
          return t - 1;
        });
      }, 1000);

      // Poll for claim every 3 seconds
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.getPairStatus(data.code);
          if (status.claimed) {
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
            setStep(3);
            setTimeout(() => navigate('/dashboard'), 2000);
          }
        } catch {}
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setStep(1);
    setCode(null);
    setDeviceName('');
    setError('');
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div style={s.page}>
      <h2 style={s.title}>Add a Device</h2>
      <p style={s.subtitle}>Pair your child's Mac using a one-time code.</p>

      {error && <div style={s.error}>{error}</div>}

      {step === 1 && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>Step 1: Name this device</h3>
          <form onSubmit={generate} style={s.form}>
            <input
              style={s.input}
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Alex's MacBook"
              required
            />
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? 'Generating…' : 'Generate Pairing Code'}
            </button>
          </form>
        </div>
      )}

      {step === 2 && code && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>Step 2: Enter this code on the child's Mac</h3>
          <div style={s.codeBox}>
            <div style={s.codeDigits}>{code}</div>
            <div style={s.countdown}>
              Expires in <strong>{formatTime(timeLeft)}</strong>
            </div>
          </div>

          <div style={s.instructions}>
            <p style={s.instrTitle}>On the child's Mac, open Terminal and run:</p>
            <code style={s.instrCode}>sudo python3 mac-agent/agent.py --pair</code>
            <p style={s.instrNote}>The agent will prompt for the server URL and this code. Once entered, this screen will update automatically.</p>
          </div>

          <div style={s.waitRow}>
            <div style={s.spinner} />
            <span style={{ color: '#6b7280', fontSize: 14 }}>Waiting for the Mac to connect…</span>
          </div>

          <button onClick={cancel} style={s.cancelBtn}>Cancel</button>
        </div>
      )}

      {step === 3 && (
        <div style={{ ...s.card, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h3 style={{ ...s.cardTitle, textAlign: 'center' }}>Device connected!</h3>
          <p style={{ color: '#6b7280' }}>Redirecting to dashboard…</p>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: 600, margin: '0 auto' },
  title: { margin: '0 0 8px', fontSize: 24, fontWeight: 700 },
  subtitle: { margin: '0 0 24px', color: '#6b7280', fontSize: 14 },
  error: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  cardTitle: { margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#1e1b4b' },
  form: { display: 'flex', gap: 12 },
  input: { flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 },
  btn: { padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  codeBox: { textAlign: 'center', margin: '0 0 28px' },
  codeDigits: { fontSize: 64, fontWeight: 800, letterSpacing: 12, color: '#1e1b4b', fontFamily: 'monospace', padding: '20px 0' },
  countdown: { fontSize: 14, color: '#6b7280' },
  instructions: { background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 20, marginBottom: 20 },
  instrTitle: { margin: '0 0 10px', fontSize: 14, color: '#374151', fontWeight: 500 },
  instrCode: { display: 'block', background: '#1e1b4b', color: '#a5b4fc', padding: '12px 16px', borderRadius: 8, fontFamily: 'monospace', fontSize: 14, marginBottom: 12 },
  instrNote: { margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 },
  waitRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  spinner: { width: 18, height: 18, border: '3px solid #e0e7ff', borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  cancelBtn: { background: 'none', border: '1px solid #d1d5db', color: '#6b7280', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
};
