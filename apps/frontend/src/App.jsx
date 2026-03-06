import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';

// A simple component we will build next to prove the login worked!
const TemporaryDashboard = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <h1 className="text-3xl font-bold text-indigo-600">Welcome to your Dashboard!</h1>
    </div>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Default route redirects to Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Route (We will lock this down properly later) */}
          <Route path="/dashboard" element={<TemporaryDashboard />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;