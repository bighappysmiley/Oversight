import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from './Icon';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'barChart' },
  { to: '/devices', label: 'Devices', icon: 'laptop' },
  { to: '/app-limits', label: 'App Limits', icon: 'clock' },
  { to: '/downtime', label: 'Downtime', icon: 'moon' },
  { to: '/restrictions', label: 'Web Filter', icon: 'lock' },
  { to: '/screen', label: 'Screen View', icon: 'monitor' },
];

export default function Layout({ children }) {
  const { parent, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
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
              to={item.to}
              style={{
                ...styles.navItem,
                ...(location.pathname === item.to ? styles.navActive : {}),
              }}
            >
              <Icon name={item.icon} size={16} color={location.pathname === item.to ? '#fff' : '#a5b4fc'} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div style={styles.user}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{parent?.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            <Icon name="logout" size={14} color="#a5b4fc" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 220,
    background: '#1e1b4b',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 20px 24px',
    borderBottom: '1px solid #312e81',
  },
  logoText: {
    color: '#e0e7ff',
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 1,
  },
  nav: {
    flex: 1,
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    color: '#a5b4fc',
    textDecoration: 'none',
    fontSize: 14,
    borderRadius: '0 8px 8px 0',
    marginRight: 12,
    transition: 'background 0.15s',
  },
  navActive: {
    background: '#4f46e5',
    color: '#fff',
  },
  user: {
    padding: '16px 20px',
    borderTop: '1px solid #312e81',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #4f46e5',
    color: '#a5b4fc',
    padding: '6px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  main: {
    marginLeft: 220,
    flex: 1,
    padding: 32,
    maxWidth: 1100,
  },
};
