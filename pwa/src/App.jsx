import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DeviceProvider } from './hooks/useDevice';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import AddDevice from './pages/AddDevice';
import AppLimits from './pages/AppLimits';
import Downtime from './pages/Downtime';
import Restrictions from './pages/Restrictions';
import ScreenView from './pages/ScreenView';

function ProtectedRoutes() {
  const { parent, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Loading…</div>;
  if (!parent) return <Navigate to="/" replace />;
  return (
    <DeviceProvider>
      <Layout>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/add-device" element={<AddDevice />} />
          <Route path="/app-limits" element={<AppLimits />} />
          <Route path="/downtime" element={<Downtime />} />
          <Route path="/restrictions" element={<Restrictions />} />
          <Route path="/screen" element={<ScreenView />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </DeviceProvider>
  );
}

function PublicRoot() {
  const { parent, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Loading…</div>;
  if (parent) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicRoot />} />
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
