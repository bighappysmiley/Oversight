import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useDevice } from '../hooks/useDevice';

export default function Devices() {
  const { devices, refresh } = useDevice();
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDevice, setNewDevice] = useState(null);
  const [error, setError] = useState('');

  async function addDevice(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError('');
    try {
      const data = await api.addDevice(newName.trim());
      setNewDevice(data.device);
      setNewName('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteDevice(id) {
    if (!confirm('Remove this device and all its data?')) return;
    try {
      await api.deleteDevice(id);
      setNewDevice(null);
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  function formatDate(ts) {
    if (!ts) return 'Never';
    return new Date(ts * 1000).toLocaleString();
  }

  return (
    <div>
      <h2 style={styles.title}>Devices</h2>
      <p style={styles.subtitle}>Each child device needs the Oversight Mac Agent installed and configured with its device token.</p>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Add a Device</h3>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>Use the guided pairing flow to connect a child's Mac in minutes.</p>
        <button onClick={() => navigate('/add-device')} style={styles.btn}>
          + Pair a New Device
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Your Devices ({devices.length})</h3>
        {devices.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No devices yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Last Seen</th>
                <th style={styles.th}>ID</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td style={styles.td}>{d.name}</td>
                  <td style={styles.td}>{formatDate(d.last_seen)}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{d.id.slice(0, 8)}…</td>
                  <td style={styles.td}>
                    <button onClick={() => deleteDevice(d.id)} style={styles.deleteBtn}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Agent Installation</h3>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2, fontSize: 14, color: '#374151' }}>
          <li>Add a device above and copy its token.</li>
          <li>On the child's Mac, clone this repo or download the <code>mac-agent/</code> folder.</li>
          <li>Run: <code style={styles.code}>pip3 install requests</code></li>
          <li>Create <code style={styles.code}>mac-agent/config.json</code> with your server URL and token.</li>
          <li>Run: <code style={styles.code}>sudo python3 mac-agent/agent.py --install</code> to register it as a system daemon.</li>
        </ol>
      </div>
    </div>
  );
}

const styles = {
  title: { margin: '0 0 8px', fontSize: 24, fontWeight: 700 },
  subtitle: { margin: '0 0 24px', color: '#6b7280', fontSize: 14 },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1e1b4b' },
  addForm: { display: 'flex', gap: 12 },
  input: { flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 },
  btn: { padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  error: { color: '#ef4444', fontSize: 13, marginTop: 8 },
  tokenBox: { marginTop: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 16 },
  tokenTitle: { margin: '0 0 8px', fontSize: 14, color: '#166534', fontWeight: 500 },
  token: { display: 'block', fontFamily: 'monospace', fontSize: 13, background: '#fff', border: '1px solid #d1fae5', padding: '8px 12px', borderRadius: 6, wordBreak: 'break-all' },
  tokenNote: { margin: '8px 0 0', fontSize: 12, color: '#6b7280' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' },
  td: { padding: '12px 12px', borderBottom: '1px solid #f9fafb', fontSize: 14, color: '#374151' },
  deleteBtn: { background: 'none', border: '1px solid #fca5a5', color: '#ef4444', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  code: { background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 },
};
