import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

function QuotaBar({ used, limit, label }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const danger = pct >= 90;
  const warn = pct >= 70;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-small">
        <span className="font-medium text-content-muted">{label}</span>
        <span className={`font-semibold ${danger ? 'text-red-300' : warn ? 'text-amber-200' : 'text-content-muted'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${danger ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-content-subtle">{pct}% used</p>
    </div>
  );
}

function PlanBadge({ plan }) {
  const isPro = plan === 'pro';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${isPro ? 'bg-accent-muted text-accent' : 'bg-surface-muted text-content-muted'}`}>
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

  const loadSub = useCallback((opts = {}) => {
    const { silent } = opts;
    if (!silent) setError('');
    return apiClient
      .get('/subscriptions/me')
      .then(({ data }) => setSub(data))
      .catch(() => {
        if (!silent) setError('Failed to load subscription info.');
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSub()
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSub]);

  useEffect(() => {
    const onFocus = () => loadSub({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadSub({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadSub]);

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
      <div className="mx-auto max-w-lg animate-fade-in pt-4">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  const isPro = sub?.plan === 'pro';

  return (
    <div className="mx-auto max-w-lg animate-fade-in pb-12 pt-2">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h2 font-bold text-content">Billing & plan</h1>
        <Link to="/pricing" className="text-small font-medium text-accent hover:underline">
          Compare plans
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-small text-red-200">
          <span className="shrink-0 text-red-400" aria-hidden>⚠</span>
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Current plan</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xl font-bold text-content">{isPro ? 'Pro' : 'Free'}</p>
                <PlanBadge plan={sub?.plan} />
                {sub?.status && sub.status !== 'active' && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200 capitalize">
                    {sub.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              {isPro && sub?.currentPeriodEnd && (
                <p className="mt-2 text-xs text-content-subtle">
                  {sub.cancelAtPeriodEnd
                    ? `Cancels on ${formatDate(sub.currentPeriodEnd)}`
                    : `Renews ${formatDate(sub.currentPeriodEnd)}`}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-content">{isPro ? '$9.99' : '$0'}</p>
              <p className="text-xs text-content-subtle">{isPro ? '/month' : 'forever'}</p>
            </div>
          </div>
        </div>

        {sub && (
          <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-content-subtle">
              Your plan
            </p>
            <div className="space-y-6">
              <QuotaBar
                label="Media files (saved)"
                used={sub.mediaCount ?? 0}
                limit={sub.maxMediaCount ?? 3}
              />
              <p className="text-xs text-content-subtle">
                After {sub.retentionDays ?? 15} days, uploads are removed from storage and marked deleted automatically.
              </p>
            </div>
            <p className="mb-4 mt-6 text-xs font-medium uppercase tracking-wide text-content-subtle">
              Plan limits
            </p>
            <div className="grid grid-cols-1 gap-4 text-small sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
                <p className="text-xs text-content-subtle">Max media</p>
                <p className="font-semibold text-content">{sub.maxMediaCount ?? 3} files</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
                <p className="text-xs text-content-subtle">Max file size</p>
                <p className="font-semibold text-content">{sub.maxFileSizeMB >= 1024 ? `${sub.maxFileSizeMB / 1024} GB` : `${sub.maxFileSizeMB} MB`}</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
                <p className="text-xs text-content-subtle">Retention</p>
                <p className="font-semibold text-content">{sub.retentionDays ?? 15} days</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
                <p className="text-xs text-content-subtle">Parallel jobs</p>
                <p className="font-semibold text-content">Up to {sub.maxParallelJobs}</p>
              </div>
            </div>
            {sub.currentPeriodStart && sub.currentPeriodEnd && (
              <p className="mt-4 text-xs text-content-subtle">
                Period: {formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl">
          {isPro ? (
            <div className="space-y-4">
              <p className="text-small text-content-muted">
                Manage your subscription, update payment method, or cancel anytime from the Stripe billing portal.
              </p>
              <button
                type="button"
                onClick={handleManage}
                disabled={actionLoading}
                className="w-full rounded-xl border border-surface-border bg-surface-muted/80 py-4 text-small font-semibold text-content transition hover:border-accent/30 disabled:opacity-60"
              >
                {actionLoading ? 'Opening…' : 'Manage billing'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-content">Upgrade to Pro — $9.99/month</p>
                <p className="mt-2 text-small text-content-muted">
                  10 media files, 800 MB per file, 30-day retention, 10 parallel jobs, priority processing.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={actionLoading}
                className="w-full rounded-xl bg-accent py-4 text-small font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              >
                {actionLoading ? 'Redirecting…' : 'Upgrade to Pro'}
              </button>
              <p className="text-center text-xs text-content-subtle">Powered by Stripe. Cancel anytime.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
