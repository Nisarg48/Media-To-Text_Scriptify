import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

function QuotaBar({ used, limit, label }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const danger = pct >= 90;
  const warn = pct >= 70;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={`font-semibold ${danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-600'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${danger ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{pct}% used</p>
    </div>
  );
}

function PlanBadge({ plan }) {
  const isPro = plan === 'pro';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${isPro ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
      {isPro ? 'Pro' : 'Free'}
    </span>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function Billing() {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/subscriptions/me')
      .then(({ data }) => setSub(data))
      .catch(() => setError('Failed to load subscription info.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade() {
    setActionLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post('/subscriptions/checkout');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to start checkout. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleManage() {
    setActionLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post('/subscriptions/portal');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to open billing portal.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg pt-4 animate-fade-in">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  const isPro = sub?.plan === 'pro';

  return (
    <div className="mx-auto max-w-lg animate-fade-in pb-12 pt-2">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Billing & plan</h1>
        <Link to="/pricing" className="text-sm font-medium text-emerald-600 hover:underline">
          Compare plans
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 text-red-500" aria-hidden>⚠</span>
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Current plan card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Current plan</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xl font-bold text-slate-800">{isPro ? 'Pro' : 'Free'}</p>
                <PlanBadge plan={sub?.plan} />
                {sub?.status && sub.status !== 'active' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 capitalize">
                    {sub.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              {isPro && sub?.currentPeriodEnd && (
                <p className="mt-1 text-xs text-slate-400">
                  {sub.cancelAtPeriodEnd
                    ? `Cancels on ${formatDate(sub.currentPeriodEnd)}`
                    : `Renews ${formatDate(sub.currentPeriodEnd)}`}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-slate-800">{isPro ? '$9.99' : '$0'}</p>
              <p className="text-xs text-slate-400">{isPro ? '/month' : 'forever'}</p>
            </div>
          </div>
        </div>

        {/* Quota card */}
        {sub && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Usage this period
            </p>
            <div className="space-y-5">
              <QuotaBar
                label="Transcription minutes"
                used={sub.minutesUsed ?? 0}
                limit={sub.minutesLimit ?? 30}
              />
              <p className="text-xs text-slate-400">
                Usage is counted when a job completes. Deleting media does not refund minutes for the current period.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Max file size</p>
                <p className="font-semibold text-slate-700">{sub.maxFileSizeMB >= 1024 ? `${sub.maxFileSizeMB / 1024} GB` : `${sub.maxFileSizeMB} MB`}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Max length / file</p>
                <p className="font-semibold text-slate-700">Up to {sub.maxDurationMinutesPerFile ?? 30} min</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Parallel jobs</p>
                <p className="font-semibold text-slate-700">Up to {sub.maxParallelJobs}</p>
              </div>
            </div>
            {sub.currentPeriodStart && sub.currentPeriodEnd && (
              <p className="mt-3 text-xs text-slate-400">
                Period: {formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {isPro ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Manage your subscription, update payment method, or cancel anytime from the Stripe billing portal.
              </p>
              <button
                type="button"
                onClick={handleManage}
                disabled={actionLoading}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                {actionLoading ? 'Opening…' : 'Manage billing'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-slate-800">Upgrade to Pro — $9.99/month</p>
                <p className="mt-1 text-sm text-slate-500">300 minutes, 2 GB files, 10 parallel jobs, priority processing.</p>
              </div>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={actionLoading}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {actionLoading ? 'Redirecting…' : 'Upgrade to Pro'}
              </button>
              <p className="text-center text-xs text-slate-400">Powered by Stripe. Cancel anytime.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
