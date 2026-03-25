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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
        Loading subscription data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-slate-500">Current plan state per user (Mongo + Stripe).</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period end</th>
                <th className="px-4 py-3">Stripe sub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No subscription documents yet.
                  </td>
                </tr>
              ) : (
                subs.map((row) => (
                  <tr key={row._id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-slate-800">
                      {row.userId?.name || '—'}{' '}
                      <span className="block text-xs text-slate-500">{row.userId?.email}</span>
                    </td>
                    <td className="px-4 py-3 font-medium capitalize">{row.plan}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.currentPeriodEnd)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
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
        <h2 className="text-xl font-bold text-slate-900">Subscription audit log</h2>
        <p className="mt-1 text-sm text-slate-500">
          Signups, upgrades, Stripe webhooks — append-only for analytics.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">From → To</th>
                <th className="px-4 py-3">Stripe event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {log.userId?.name || '—'}{' '}
                      <span className="block text-xs text-slate-500">{log.userId?.email}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(log.fromPlan || '—') + ' → ' + (log.toPlan || '—')}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-500">
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
