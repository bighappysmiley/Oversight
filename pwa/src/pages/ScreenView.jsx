import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useDevice } from '../hooks/useDevice';
import DevicePicker from '../components/DevicePicker';

export default function ScreenView() {
  const { selected } = useDevice();
  const [enabled, setEnabled] = useState(false);
  const [frame, setFrame] = useState(null);
  const [capturedAt, setCapturedAt] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [noFrame, setNoFrame] = useState(false);
  const pollRef = useRef(null);
  const clockRef = useRef(null);

  useEffect(() => {
    if (!selected) return;
    // Fetch initial state
    fetchFrame();
    return () => {
      clearInterval(pollRef.current);
      clearInterval(clockRef.current);
    };
  }, [selected]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (enabled && selected) {
      pollRef.current = setInterval(fetchFrame, 2000);
    }
  }, [enabled, selected]);

  useEffect(() => {
    clearInterval(clockRef.current);
    if (capturedAt) {
      clockRef.current = setInterval(() => {
        setSecondsAgo(Math.floor(Date.now() / 1000) - capturedAt);
      }, 1000);
    }
  }, [capturedAt]);

  async function fetchFrame() {
    try {
      const data = await api.getScreenFrame(selected.id);
      setEnabled(data.streaming_enabled);
      if (data.frame) {
        setFrame(data.frame);
        setCapturedAt(data.captured_at);
        setNoFrame(false);
      }
    } catch (err) {
      if (err.message && err.message.includes('No frame')) {
        setNoFrame(true);
      }
    }
  }

  async function toggle() {
    setToggling(true);
    try {
      await api.toggleScreenStream(selected.id, !enabled);
      setEnabled(!enabled);
      if (!enabled) {
        // Just enabled — start polling immediately
        fetchFrame();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setToggling(false);
    }
  }

  if (!selected) return <p style={{ color: '#6b7280' }}>Select a device first.</p>;

  return (
    <div>
      <div style={s.topBar}>
        <div>
          <h2 style={s.title}>Live Screen View</h2>
          <p style={s.subtitle}>View a real-time screenshot of your child's Mac.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DevicePicker />
        </div>
      </div>

      <div style={s.card}>
        <div style={s.controlRow}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 15, color: '#1e1b4b' }}>Screen Streaming</span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              {enabled ? 'Active — capturing every 2 seconds on the device.' : 'Disabled — the agent is not capturing screens.'}
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={toggling}
            style={enabled ? s.disableBtn : s.enableBtn}
          >
            {toggling ? '…' : enabled ? 'Disable' : 'Enable Screen Viewing'}
          </button>
        </div>
      </div>

      <div style={s.frameCard}>
        {!enabled && !frame ? (
          <div style={s.placeholder}>
            <span style={{ fontSize: 48 }}>🔒</span>
            <p style={s.placeholderText}>Screen viewing is disabled</p>
            <p style={s.placeholderSub}>Enable it above to start viewing screenshots.</p>
          </div>
        ) : noFrame && !frame ? (
          <div style={s.placeholder}>
            <div style={s.spinner} />
            <p style={s.placeholderText}>Waiting for first frame from device…</p>
            <p style={s.placeholderSub}>Make sure the Mac Agent is running.</p>
          </div>
        ) : frame ? (
          <>
            <img
              src={`data:image/jpeg;base64,${frame}`}
              alt="Live screen"
              style={s.frameImg}
            />
            <div style={s.frameFooter}>
              {secondsAgo !== null && (
                <span style={s.timestamp}>
                  Last updated: {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}
                </span>
              )}
              {!enabled && <span style={s.pausedBadge}>Paused</span>}
            </div>
          </>
        ) : (
          <div style={s.placeholder}>
            <div style={s.spinner} />
            <p style={s.placeholderText}>Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { margin: '0 0 4px', fontSize: 24, fontWeight: 700 },
  subtitle: { margin: 0, color: '#6b7280', fontSize: 14 },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  enableBtn: { padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  disableBtn: { padding: '10px 24px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  frameCard: { background: '#111827', borderRadius: 12, overflow: 'hidden', minHeight: 400, display: 'flex', flexDirection: 'column' },
  placeholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60, color: '#fff' },
  placeholderText: { margin: 0, fontSize: 18, fontWeight: 600, color: '#e5e7eb' },
  placeholderSub: { margin: 0, fontSize: 14, color: '#9ca3af' },
  frameImg: { width: '100%', display: 'block' },
  frameFooter: { padding: '10px 16px', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  timestamp: { fontSize: 13, color: '#d1d5db' },
  pausedBadge: { background: '#fef3c7', color: '#92400e', fontSize: 12, padding: '2px 8px', borderRadius: 99, fontWeight: 600 },
  spinner: { width: 24, height: 24, border: '3px solid #374151', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' },
};
