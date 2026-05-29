import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useDevice } from '../hooks/useDevice';
import DevicePicker from '../components/DevicePicker';

const DEFAULT_DOWNTIME = {
  enabled: false,
  start: '22:00',
  end: '07:00',
  allowed_apps: [],
};

export default function Downtime() {
  const { selected } = useDevice();
  const [downtime, setDowntime] = useState(DEFAULT_DOWNTIME);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newApp, setNewApp] = useState('');

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.getSettings(selected.id)
      .then((s) => setDowntime(s.downtime))
      .finally(() => setLoading(false));
  }, [selected]);

  async function save(updated) {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings(selected.id, { downtime: updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function update(field, value) {
    const updated = { ...downtime, [field]: value };
    setDowntime(updated);
    save(updated);
  }

  function addAllowedApp() {
    if (!newApp.trim()) return;
    const updated = { ...downtime, allowed_apps: [...downtime.allowed_apps, newApp.trim()] };
    setDowntime(updated);
    save(updated);
    setNewApp('');
  }

  function removeAllowedApp(app) {
    const updated = { ...downtime, allowed_apps: downtime.allowed_apps.filter((a) => a !== app) };
    setDowntime(updated);
    save(updated);
  }

  if (!selected) return <p style={{ color: '#6b7280' }}>Select a device first.</p>;

  return (
    <div>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.title}>Downtime</h2>
          <p style={styles.subtitle}>Schedule a period where only allowed apps are accessible.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={styles.savedBadge}>✓ Saved</span>}
          <DevicePicker />
        </div>
      </div>

      {loading ? <p>Loading…</p> : (
        <>
          <div style={styles.card}>
            <div style={styles.row}>
              <div>
                <h3 style={styles.sectionTitle}>Enable Downtime</h3>
                <p style={styles.desc}>When enabled, all apps except those in the allowed list will be blocked during the scheduled hours.</p>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={downtime.enabled}
                  onChange={(e) => update('enabled', e.target.checked)}
                  style={{ display: 'none' }}
                />
                <span style={{ ...styles.toggleTrack, background: downtime.enabled ? '#4f46e5' : '#d1d5db' }}>
                  <span style={{ ...styles.toggleThumb, transform: downtime.enabled ? 'translateX(24px)' : 'translateX(2px)' }} />
                </span>
              </label>
            </div>

            {downtime.enabled && (
              <div style={styles.timeRow}>
                <label style={styles.timeLabel}>
                  Start time
                  <input
                    type="time"
                    value={downtime.start}
                    onChange={(e) => update('start', e.target.value)}
                    style={styles.timeInput}
                  />
                </label>
                <span style={{ fontSize: 20, color: '#9ca3af' }}>→</span>
                <label style={styles.timeLabel}>
                  End time
                  <input
                    type="time"
                    value={downtime.end}
                    onChange={(e) => update('end', e.target.value)}
                    style={styles.timeInput}
                  />
                </label>
                <div style={styles.hint}>
                  <span>🌙</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Overnight periods (end &lt; start) are supported.</span>
                </div>
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Allowed Apps During Downtime</h3>
            <p style={styles.desc}>These apps remain accessible even when downtime is active (e.g. Phone, Messages).</p>
            <div style={styles.addRow}>
              <input
                style={styles.input}
                placeholder="App name (e.g. Messages)"
                value={newApp}
                onChange={(e) => setNewApp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAllowedApp()}
              />
              <button onClick={addAllowedApp} style={styles.btn}>Add</button>
            </div>
            <div style={styles.tags}>
              {downtime.allowed_apps.length === 0
                ? <span style={{ color: '#9ca3af', fontSize: 14 }}>No allowed apps — all apps blocked during downtime.</span>
                : downtime.allowed_apps.map((app) => (
                  <span key={app} style={styles.tag}>
                    {app}
                    <button onClick={() => removeAllowedApp(app)} style={styles.tagRemove}>×</button>
                  </span>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { margin: '0 0 4px', fontSize: 24, fontWeight: 700 },
  subtitle: { margin: 0, color: '#6b7280', fontSize: 14 },
  savedBadge: { background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 99, fontSize: 13, fontWeight: 500 },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  sectionTitle: { margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#1e1b4b' },
  desc: { margin: '0 0 16px', color: '#6b7280', fontSize: 14 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  toggle: { cursor: 'pointer', flexShrink: 0 },
  toggleTrack: { display: 'block', width: 52, height: 28, borderRadius: 99, position: 'relative', transition: 'background 0.2s' },
  toggleThumb: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s' },
  timeRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' },
  timeLabel: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: '#374151' },
  timeInput: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 },
  hint: { display: 'flex', alignItems: 'center', gap: 6 },
  addRow: { display: 'flex', gap: 12, marginBottom: 16 },
  input: { flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  btn: { padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: { display: 'flex', alignItems: 'center', gap: 6, background: '#ede9fe', color: '#4f46e5', padding: '4px 12px', borderRadius: 99, fontSize: 14, fontWeight: 500 },
  tagRemove: { background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 16, padding: 0, lineHeight: 1 },
};
