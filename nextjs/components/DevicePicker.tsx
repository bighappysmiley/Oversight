'use client';

import { useDevice } from './DeviceProvider';

export default function DevicePicker() {
  const { devices, selected, setSelected } = useDevice();
  if (devices.length === 0) return null;
  return (
    <select
      value={selected?.id || ''}
      onChange={(e) => {
        const d = devices.find((dev) => dev.id === e.target.value);
        setSelected(d || null);
      }}
      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff', cursor: 'pointer' }}
    >
      {devices.map((d) => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );
}
