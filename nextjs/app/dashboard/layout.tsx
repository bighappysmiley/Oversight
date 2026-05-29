'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { DeviceProvider } from '@/components/DeviceProvider';
import Icon from '@/components/Icon';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'barChart' },
  { to: '/dashboard/devices', label: 'Devices', icon: 'laptop' },
  { to: '/dashboard/add-device', label: 'Add Device', icon: 'plus' },
  { to: '/dashboard/app-limits', label: 'App Limits', icon: 'clock' },
  { to: '/dashboard/downtime', label: 'Downtime', icon: 'moon' },
  { to: '/dashboard/restrictions', label: 'Web Filter', icon: 'lock' },
  { to: '/dashboard/screen', label: 'Screen View', icon: 'monitor' },
];

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { parent, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !parent) {
      router.push('/login');
    }
  }, [parent, loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </div>
    );
  }

  if (!parent) return null;

  function handleLogout() {
    logout().then(() => router.push('/login'));
  }

  return (
    <DeviceProvider>
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <Icon name="eye" size={28} color="#818cf8" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={styles.logoText}>Oversight</span>
            <span style={{ fontSize: 10, color: '#6366f1', letterSpacing: 1 }}>BY BIGHAPPYSMILEY</span>
          </div>
        </div>
        <nav style={styles.nav}>
          {NAV.map((item) => (
            <Link
              key={item.to}
              href={item.to}
              style={{
                ...styles.navItem,
                ...(pathname === item.to ? styles.navActive : {}),
              }}
            >
              <Icon name={item.icon} size={16} color={pathname === item.to ? '#fff' : '#a5b4fc'} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div style={styles.user}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{parent.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            <Icon name="logout" size={14} color="#a5b4fc" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
    </DeviceProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardInner>{children}</DashboardInner>
    </AuthProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: { width: 220, background: '#1e1b4b', display: 'flex', flexDirection: 'column', padding: '24px 0', position: 'fixed', top: 0, bottom: 0, left: 0 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 24px', borderBottom: '1px solid #312e81' },
  logoText: { color: '#e0e7ff', fontWeight: 700, fontSize: 18, lineHeight: 1 },
  nav: { flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', color: '#a5b4fc', textDecoration: 'none', fontSize: 14, borderRadius: '0 8px 8px 0', marginRight: 12 },
  navActive: { background: '#4f46e5', color: '#fff' },
  user: { padding: '16px 20px', borderTop: '1px solid #312e81', display: 'flex', flexDirection: 'column', gap: 8 },
  logoutBtn: { background: 'none', border: '1px solid #4f46e5', color: '#a5b4fc', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  main: { marginLeft: 220, flex: 1, padding: 32, maxWidth: 1100 },
};
