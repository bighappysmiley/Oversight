'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useDevice } from '@/components/DeviceProvider';

export default function DevicesPage() {
  const { devices, refresh } = useDevice();
  const router = useRouter();
  const [error, setError] = useState('');

  async function deleteDevice(id: string) {
    if (!confirm('Remove this device and all its data?')) return;
    try {
      await api.deleteDevice(id);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function formatDate(ts?: number) {
    if (!ts) return 'Never';
    return new Date(ts * 1000).toLocaleString();
  }

  return (
    <div>
      <h2 style={styles.title}>Devices</h2>
      <p style={styles.subtitle}>Each child device needs the Oversight agent installed and configured with its device token.</p>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Add a Device</h3>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>Use the guided pairing flow to connect a child's device.</p>
        <button onClick={() => router.push('/dashboard/add-device')} style={styles.btn}>
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
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{d.id.slice(0, 8)}...</td>
                  <td style={styles.td}>
                    <button onClick={() => deleteDevice(d.id)} style={styles.deleteBtn}>Remove</button>
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
  title: { margin: '0 0 8px', fontSize: 24, fontWeight: 700 },
  subtitle: { margin: '0 0 24px', color: '#6b7280', fontSize: 14 },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1e1b4b' },
  btn: { padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  error: { color: '#ef4444', fontSize: 13, marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' },
  td: { padding: '12px 12px', borderBottom: '1px solid #f9fafb', fontSize: 14, color: '#374151' },
  deleteBtn: { background: 'none', border: '1px solid #fca5a5', color: '#ef4444', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
};
