import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';

const getErrorMessage = (err) => {
  const data = err.response?.data;
  if (data?.errors?.length) return data.errors[0].msg;
  return data?.message || 'Registration failed. Please try again.';
};

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useContext(AuthContext);

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/register', formData);
      navigate(`/login${location.search || ''}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 py-8 sm:py-12 lg:py-16">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.02)_1px,transparent_1px)] bg-[size:48px_48px]" aria-hidden />

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 lg:p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">Scriptify</h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">Create an account to get started</p>
          </div>

          {error && (
            <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-shake">
              <span className="shrink-0 text-red-500" aria-hidden>⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="register-name" className="sr-only">Full name</label>
              <input
                id="register-name"
                type="text"
                required
                autoComplete="name"
                placeholder="Full name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white sm:py-3.5"
              />
            </div>
            <div>
              <label htmlFor="register-email" className="sr-only">Email address</label>
              <input
                id="register-email"
                type="email"
                required
                autoComplete="email"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white sm:py-3.5"
              />
            </div>
            <div>
              <label htmlFor="register-password" className="sr-only">Password</label>
              <input
                id="register-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Password (min 8 characters)"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white sm:py-3.5"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none active:scale-[0.99] sm:py-4"
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to={{ pathname: '/login', search: location.search }} className="font-medium text-emerald-600 transition hover:text-emerald-700 focus:outline-none focus:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
