'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

interface Device {
  id: string;
  name: string;
  last_seen?: number;
  created_at?: number;
}

interface DeviceContextType {
  devices: Device[];
  selected: Device | null;
  setSelected: (d: Device | null) => void;
  refresh: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | null>(null);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const { parent } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);

  async function refresh() {
    if (!parent) return;
    try {
      const data = await api.listDevices();
      setDevices(data.devices);
      if (data.devices.length > 0 && !selected) {
        setSelected(data.devices[0]);
      }
    } catch {}
  }

  useEffect(() => {
    refresh();
  }, [parent]);

  return (
    <DeviceContext.Provider value={{ devices, selected, setSelected, refresh }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
}
