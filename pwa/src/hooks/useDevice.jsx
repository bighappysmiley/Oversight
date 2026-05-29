import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('oversight_device'));
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await api.listDevices();
      setDevices(data.devices);
      if (!selectedId && data.devices.length > 0) {
        select(data.devices[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  function select(id) {
    setSelectedId(id);
    localStorage.setItem('oversight_device', id);
  }

  const selected = devices.find((d) => d.id === selectedId) || null;

  return (
    <DeviceContext.Provider value={{ devices, selected, loading, select, refresh }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  return useContext(DeviceContext);
}
