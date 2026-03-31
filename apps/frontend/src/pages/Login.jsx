import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';
import PasswordField from '../components/PasswordField';

const getErrorMessage = (err) => {
  const data = err.response?.data;
  if (data?.errors?.length) return data.errors[0].msg;
  return data?.message || 'Invalid email or password.';
};

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { token, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const defaultAfterLoginPath = '/dashboard/upload';

  useEffect(() => {
    if (token) {
      navigate(defaultAfterLoginPath, { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', formData);
      login(res.data.token, defaultAfterLoginPath);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-transparent px-4 py-8 sm:py-12 lg:py-16">
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden
      />

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-h2 font-bold tracking-tight text-content sm:text-h1">
              Scriptify
            </h1>
            <p className="mt-2 text-small text-content-muted">
              Sign in to your account
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-small text-rose-200 animate-shake"
            >
              <span className="shrink-0 text-rose-400" aria-hidden>⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="sr-only">Email address</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-surface-border bg-surface-muted/50 px-4 py-3 text-content placeholder-content-subtle outline-none transition duration-200 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:bg-surface/80 sm:py-4"
              />
            </div>
            <PasswordField
              id="login-password"
              label="Password"
              required
              autoComplete="current-password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-4 text-small font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas disabled:pointer-events-none disabled:opacity-60 active:scale-[0.99]"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-small text-content-muted">
            Don&apos;t have an account?{' '}
            <Link
              to={{ pathname: '/register', search: location.search }}
              className="font-medium text-accent transition hover:brightness-125 focus:outline-none focus:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
