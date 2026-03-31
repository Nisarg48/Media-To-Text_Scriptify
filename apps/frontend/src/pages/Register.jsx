import { useState, useContext, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';
import PasswordField from '../components/PasswordField';

const getErrorMessage = (err) => {
  const data = err.response?.data;
  if (data?.errors?.length) return data.errors[0].msg;
  return data?.message || 'Registration failed. Please try again.';
};

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [initialPlan, setInitialPlan] = useState('free');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { token, login } = useContext(AuthContext);

  const planFromUrl = useMemo(() => {
    const p = (searchParams.get('plan') || '').toLowerCase();
    return p === 'pro' ? 'pro' : 'free';
  }, [searchParams]);

  useEffect(() => {
    setInitialPlan(planFromUrl);
  }, [planFromUrl]);

  useEffect(() => {
    if (token) {
      navigate('/dashboard/upload', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/register', {
        ...formData,
        initialPlan,
      });

      if (data.initialPlan === 'pro') {
        localStorage.setItem('token', data.token);
        try {
          const { data: co } = await apiClient.post('/subscriptions/checkout');
          if (co?.url) {
            window.location.href = co.url;
            return;
          }
          setError('Billing is not configured. You can upgrade later from Billing.');
        } catch (checkoutErr) {
          setError(getErrorMessage(checkoutErr) || 'Could not start checkout. Try Billing after sign-in.');
        }
        login(data.token, '/dashboard/billing');
        return;
      }

      login(data.token, '/dashboard/upload');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-surface-border bg-surface-muted/50 px-4 py-3 text-content placeholder-content-subtle outline-none transition duration-200 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:bg-surface/80 sm:py-4';

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-transparent px-4 py-8 sm:py-12 lg:py-16">
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden
      />

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-h2 font-bold tracking-tight text-content sm:text-h1">Scriptify</h1>
            <p className="mt-2 text-small text-content-muted sm:text-body">Create an account and choose a plan</p>
          </div>

          {error && (
            <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-small text-rose-200 animate-shake">
              <span className="shrink-0 text-rose-400" aria-hidden>⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="space-y-4 rounded-xl border border-surface-border bg-surface-muted/40 p-4">
              <legend className="text-small font-semibold text-content">Plan</legend>
              <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-transparent p-2 transition hover:bg-surface-muted/60 has-[:checked]:border-accent/50 has-[:checked]:bg-accent-muted">
                <input
                  type="radio"
                  name="plan"
                  className="mt-1 accent-accent"
                  checked={initialPlan === 'free'}
                  onChange={() => setInitialPlan('free')}
                />
                <span>
                  <span className="font-medium text-content">Free</span>
                  <span className="mt-1 block text-xs text-content-subtle">
                    30 min/month, no card required. Upgrade anytime.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-transparent p-2 transition hover:bg-surface-muted/60 has-[:checked]:border-accent/50 has-[:checked]:bg-accent-muted">
                <input
                  type="radio"
                  name="plan"
                  className="mt-1 accent-accent"
                  checked={initialPlan === 'pro'}
                  onChange={() => setInitialPlan('pro')}
                />
                <span>
                  <span className="font-medium text-content">Pro</span>
                  <span className="mt-1 block text-xs text-content-subtle">
                    300 min/month — you&apos;ll complete Stripe checkout after signup.
                  </span>
                </span>
              </label>
            </fieldset>

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
                className={inputClass}
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
                className={inputClass}
              />
            </div>
            <PasswordField
              id="register-password"
              label="Password"
              required
              autoComplete="new-password"
              placeholder="Password (min 8 characters)"
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-4 text-small font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas disabled:pointer-events-none disabled:opacity-60 active:scale-[0.99]"
            >
              {loading ? 'Creating account…' : initialPlan === 'pro' ? 'Continue to checkout' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-small text-content-muted">
            Already have an account?{' '}
            <Link to={{ pathname: '/login', search: location.search }} className="font-medium text-accent transition hover:brightness-125 focus:outline-none focus:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-4 text-center text-xs text-content-subtle">
            <Link to="/pricing" className="text-accent hover:underline">Compare plans</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
