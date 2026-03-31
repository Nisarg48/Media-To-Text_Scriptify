import { useState, useEffect } from 'react';
import apiClient from '../../api/client';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminSubscriptions() {
  const [subs, setSubs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get('/admin/subscriptions'),
      apiClient.get('/admin/subscriptions/audit?limit=100'),
    ])
      .then(([s, l]) => {
        if (!cancelled) {
          setSubs(s.data.subscriptions || []);
          setLogs(l.data.logs || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.msg || 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface/90 p-8 text-content-muted">
        Loading subscription data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-red-200" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-h2 font-bold text-content">Subscriptions</h1>
        <p className="mt-2 text-small text-content-muted">Current plan state per user (Mongo + Stripe).</p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-surface-border bg-surface/90 shadow-glass">
          <table className="admin-data-table min-w-full text-left text-small">
            <thead className="text-xs font-semibold uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period end</th>
                <th className="px-4 py-3">Stripe sub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-content-muted">
                    No subscription documents yet.
                  </td>
                </tr>
              ) : (
                subs.map((row) => (
                  <tr key={row._id} className="hover:bg-surface-muted/30">
                    <td className="px-4 py-3 text-content">
                      {row.userId?.name || '—'}{' '}
                      <span className="block text-xs text-content-subtle">{row.userId?.email}</span>
                    </td>
                    <td className="px-4 py-3 font-medium capitalize">{row.plan}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3 text-content-muted">{formatDate(row.currentPeriodEnd)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-content-subtle">
                      {row.stripeSubscriptionId || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-h3 font-bold text-content">Subscription audit log</h2>
        <p className="mt-2 text-small text-content-muted">
          Signups, upgrades, Stripe webhooks — append-only for analytics.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-surface-border bg-surface/90 shadow-glass">
          <table className="admin-data-table min-w-full text-left text-small">
            <thead className="text-xs font-semibold uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">From → To</th>
                <th className="px-4 py-3">Stripe event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-content-muted">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-surface-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-content-muted">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3 text-content">
                      {log.userId?.name || '—'}{' '}
                      <span className="block text-xs text-content-subtle">{log.userId?.email}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-content">{log.action}</td>
                    <td className="px-4 py-3 text-content-muted">
                      {(log.fromPlan || '—') + ' → ' + (log.toPlan || '—')}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-content-subtle">
                      {log.stripeEventId || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
