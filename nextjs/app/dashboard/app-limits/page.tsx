'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useDevice } from '@/components/DeviceProvider';
import DevicePicker from '@/components/DevicePicker';

const DEFAULT_LIMIT = { app_name: '', bundle_id: '', daily_limit_minutes: 60 };

export default function AppLimitsPage() {
  const { selected } = useDevice();
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newLimit, setNewLimit] = useState({ ...DEFAULT_LIMIT });

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.getSettings(selected.id)
      .then((s) => setLimits(s.app_limits))
      .finally(() => setLoading(false));
  }, [selected]);

  async function save(updatedLimits: any[]) {
    setSaving(true); setSaved(false);
    try {
      await api.updateSettings(selected!.id, { app_limits: updatedLimits });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  function addLimit() {
    if (!newLimit.app_name.trim()) return;
    const updated = [...limits, { ...newLimit }];
    setLimits(updated); save(updated);
    setNewLimit({ ...DEFAULT_LIMIT });
  }

  function removeLimit(i: number) {
    const updated = limits.filter((_, idx) => idx !== i);
    setLimits(updated); save(updated);
  }

  function updateLimit(i: number, field: string, value: any) {
    const updated = limits.map((l, idx) => idx === i ? { ...l, [field]: value } : l);
    setLimits(updated);
  }

  if (!selected) return <p style={{ color: '#6b7280' }}>Select a device first.</p>;

  return (
    <div>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.title}>App Limits</h2>
          <p style={styles.subtitle}>Set daily time limits per app. The agent will block the app when the limit is reached.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={styles.savedBadge}>Saved</span>}
          <DevicePicker />
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Add App Limit</h3>
        <div style={styles.addRow}>
          <input style={styles.input} placeholder="App name (e.g. Safari)" value={newLimit.app_name}
            onChange={(e) => setNewLimit({ ...newLimit, app_name: e.target.value })} />
          <input style={{ ...styles.input, width: 200 }} placeholder="Bundle ID (optional)" value={newLimit.bundle_id}
            onChange={(e) => setNewLimit({ ...newLimit, bundle_id: e.target.value })} />
          <div style={styles.minutesWrap}>
            <input type="number" min={1} max={1440} style={{ ...styles.input, width: 80 }} value={newLimit.daily_limit_minutes}
              onChange={(e) => setNewLimit({ ...newLimit, daily_limit_minutes: +e.target.value })} />
            <span style={styles.unit}>min/day</span>
          </div>
          <button onClick={addLimit} style={styles.btn}>Add</button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Active Limits</h3>
        {loading ? <p style={{ color: '#9ca3af' }}>Loading...</p> : limits.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No app limits set.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>App</th>
                <th style={styles.th}>Bundle ID</th>
                <th style={styles.th}>Daily Limit</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {limits.map((l, i) => (
                <tr key={i}>
                  <td style={styles.td}>
                    <input style={styles.inlineInput} value={l.app_name}
                      onChange={(e) => updateLimit(i, 'app_name', e.target.value)}
                      onBlur={() => save(limits)} />
                  </td>
                  <td style={styles.td}>
                    <input style={styles.inlineInput} value={l.bundle_id}
                      onChange={(e) => updateLimit(i, 'bundle_id', e.target.value)}
                      onBlur={() => save(limits)} />
                  </td>
                  <td style={styles.td}>
                    <div style={styles.minutesWrap}>
                      <input type="number" min={1} max={1440} style={{ ...styles.inlineInput, width: 70 }} value={l.daily_limit_minutes}
                        onChange={(e) => updateLimit(i, 'daily_limit_minutes', +e.target.value)}
                        onBlur={() => save(limits)} />
                      <span style={styles.unit}>min</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => removeLimit(i)} style={styles.removeBtn}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { margin: '0 0 4px', fontSize: 24, fontWeight: 700 },
  subtitle: { margin: 0, color: '#6b7280', fontSize: 14 },
  savedBadge: { background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 99, fontSize: 13, fontWeight: 500 },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1e1b4b' },
  addRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  input: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, flex: 1, minWidth: 120 },
  inlineInput: { padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, width: '100%' },
  minutesWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  unit: { fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' },
  btn: { padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f9fafb', fontSize: 14 },
  removeBtn: { background: 'none', border: '1px solid #fca5a5', color: '#ef4444', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
};
