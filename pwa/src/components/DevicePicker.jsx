import { useDevice } from '../hooks/useDevice';

export default function DevicePicker() {
  const { devices, selected, select } = useDevice();
  if (devices.length === 0) return null;
  return (
    <div style={styles.wrap}>
      <span style={styles.label}>Device:</span>
      <select
        value={selected?.id || ''}
        onChange={(e) => select(e.target.value)}
        style={styles.select}
      >
        {devices.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, color: '#6b7280' },
  select: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    background: '#fff',
    cursor: 'pointer',
  },
};
