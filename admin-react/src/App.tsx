import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BootLoader } from './components/BootLoader';
import { Layout } from './components/Layout';
import { ModalHost } from './components/Modal';
import { ToastHost } from './components/Toast';
import { ConfirmHost } from './components/ConfirmDialog';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Cars } from './pages/Cars';
import { Bookings } from './pages/Bookings';
import { Users } from './pages/Users';
import { Claims } from './pages/Claims';
import { Reviews } from './pages/Reviews';
import { Offers } from './pages/Offers';
import { Rewards } from './pages/Rewards';
import { Subscriptions } from './pages/Subscriptions';
import { Payouts } from './pages/Payouts';
import { Support } from './pages/Support';
import { Broadcast } from './pages/Broadcast';
import { Settings } from './pages/Settings';

function Shell() {
  const { ready, loggedIn } = useAuth();

  if (!ready) return <BootLoader />;

  if (!loggedIn) return <Login />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cars" element={<Cars />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="users" element={<Users />} />
          <Route path="claims" element={<Claims />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="offers" element={<Offers />} />
          <Route path="rewards" element={<Rewards />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="support" element={<Support />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
      <ModalHost />
      <ToastHost />
      <ConfirmHost />
    </AuthProvider>
  );
}
