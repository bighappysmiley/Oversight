import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DeviceProvider } from './hooks/useDevice';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import AppLimits from './pages/AppLimits';
import Downtime from './pages/Downtime';
import Restrictions from './pages/Restrictions';

function ProtectedRoutes() {
  const { parent, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Loading…</div>;
  if (!parent) return <Navigate to="/login" replace />;
  return (
    <DeviceProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/app-limits" element={<AppLimits />} />
          <Route path="/downtime" element={<Downtime />} />
          <Route path="/restrictions" element={<Restrictions />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </DeviceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
