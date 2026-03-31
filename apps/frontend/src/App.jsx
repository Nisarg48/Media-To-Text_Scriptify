import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import DashboardLayout from './components/DashboardLayout';
import AdminLayout from './components/AdminLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import MediaDetail from './pages/MediaDetail';
import Pricing from './pages/Pricing';
import Billing from './pages/Billing';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMedia from './pages/admin/AdminMedia';
import AdminMediaDetail from './pages/admin/AdminMediaDetail';
import AdminUsers from './pages/admin/AdminUsers';
import AdminJobs from './pages/admin/AdminJobs';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* User dashboard */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="dashboard/upload" element={<Upload />} />
            <Route path="dashboard/billing" element={<Billing />} />
            <Route path="dashboard/profile" element={<Profile />} />
            <Route path="media/:id" element={<MediaDetail />} />
          </Route>

          {/* Admin panel */}
          <Route
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/media" element={<AdminMedia />} />
            <Route path="admin/media/:id" element={<AdminMediaDetail />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/jobs" element={<AdminJobs />} />
            <Route path="admin/subscriptions" element={<AdminSubscriptions />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
