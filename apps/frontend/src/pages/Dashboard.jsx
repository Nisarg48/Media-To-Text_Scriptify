import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

const STATUS_CONFIG = {
  UPLOADING: { label: 'Uploading', className: 'bg-slate-200 text-slate-700' },
  UPLOADED: { label: 'Queued', className: 'bg-slate-200 text-slate-700' },
  PROCESSING: { label: 'Processing', className: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Done', className: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

const MEDIA_TYPE_LABELS = {
  VIDEO: { label: 'Video', className: 'bg-blue-100 text-blue-800' },
  AUDIO: { label: 'Audio', className: 'bg-violet-100 text-violet-800' },
};

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'UPLOADING', label: 'Uploading' },
  { value: 'UPLOADED', label: 'Queued' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'FAILED', label: 'Failed' },
];

const PAGE_SIZE = 12;

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function StatCard({ label, value, sub, accent }) {
  const accentMap = {
    green: 'border-l-emerald-400 bg-emerald-50',
    amber: 'border-l-amber-400 bg-amber-50',
    red: 'border-l-red-400 bg-red-50',
    slate: 'border-l-slate-300 bg-slate-50',
    blue: 'border-l-blue-400 bg-blue-50',
  };
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${accentMap[accent] ?? accentMap.slate}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function UsageStats({ stats, loading }) {
  if (loading) {
    return (
      <div className="mb-6 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }
  if (!stats) return null;

  const { totalFiles, byStatus, storageBytesUsed, processingMinutes, subscription } = stats;
  const inFlight = (byStatus?.PROCESSING ?? 0) + (byStatus?.UPLOADED ?? 0);

  const minutesUsed = subscription?.minutesUsed ?? 0;
  const minutesLimit = subscription?.minutesLimit ?? 30;
  const pct = minutesLimit > 0 ? Math.min(100, Math.round((minutesUsed / minutesLimit) * 100)) : 0;
  const danger = pct >= 90;
  const warn = pct >= 70;
  const isPro = subscription?.plan === 'pro';

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Total files" value={totalFiles} accent="slate" />
        <StatCard label="Completed" value={byStatus?.COMPLETED ?? 0} accent="green" />
        <StatCard label="In progress" value={inFlight} sub={inFlight > 0 ? 'Processing or queued' : undefined} accent="amber" />
        <StatCard label="Failed" value={byStatus?.FAILED ?? 0} accent="red" />
        <StatCard label="Storage used" value={formatBytes(storageBytesUsed)} sub={processingMinutes > 0 ? `${processingMinutes} min transcribed` : undefined} accent="blue" />
      </div>

      {/* Quota bar */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Transcription quota</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isPro ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {isPro ? 'Pro' : 'Free'}
              </span>
            </div>
            <span className={`text-xs font-semibold tabular-nums ${danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-600'}`}>
              {minutesUsed} / {minutesLimit} min
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${danger ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {!isPro && (
          <a href="/dashboard/billing" className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-600">
            Upgrade
          </a>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [media, setMedia] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/analytics/me')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/media', {
        params: {
          q: searchDebounced || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          page,
          limit: PAGE_SIZE,
        },
      });
      setMedia(data.media || []);
      setTotal(typeof data.total === 'number' ? data.total : (data.media || []).length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load media.');
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, statusFilter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, statusFilter]);

  const filteredMedia = useMemo(() => {
    if (typeFilter === 'all') return media;
    return media.filter((m) => m.mediaType === typeFilter);
  }, [media, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading && media.length === 0 && !error) {
    return (
      <div className="animate-fade-in pb-8 pt-1">
        <UsageStats stats={stats} loading={statsLoading} />
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        {error}
      </div>
    );
  }

  if (media.length === 0 && total === 0 && !searchDebounced && statusFilter === 'all') {
    return (
      <div className="animate-fade-in">
        <UsageStats stats={stats} loading={statsLoading} />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg sm:p-12">
          <h2 className="text-xl font-semibold text-slate-800 sm:text-2xl">No media yet</h2>
          <p className="mt-2 text-slate-600">Upload your first audio or video to get a transcript.</p>
          <Link
            to="/dashboard/upload"
            className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            Upload media
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-8 pt-1">
      <UsageStats stats={stats} loading={statsLoading} />

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Your media</h1>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename…"
              className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none ring-emerald-500/20 transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 sm:max-w-xs"
              aria-label="Search media by filename"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              aria-label="Filter by status"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm" role="group" aria-label="Filter by type">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTypeFilter(opt.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  typeFilter === opt.value
                    ? 'bg-white text-emerald-700 shadow-md'
                    : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {total > 0 && (
            <p className="text-sm text-slate-500">
              {total} item{total !== 1 ? 's' : ''}
              {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
            </p>
          )}
        </div>
      </div>

      {filteredMedia.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">
            No media matches your filters.
            {(searchDebounced || statusFilter !== 'all' || typeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="ml-1 font-medium text-emerald-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      ) : (
        <>
          {loading && media.length > 0 && (
            <p className="mb-2 text-center text-xs text-slate-400" aria-live="polite">
              Updating…
            </p>
          )}
          <ul className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${loading && media.length > 0 ? 'opacity-70' : ''}`}>
            {filteredMedia.map((item, i) => {
              const statusInfo = STATUS_CONFIG[item.status] || { label: item.status, className: 'bg-slate-200 text-slate-700' };
              const typeInfo = MEDIA_TYPE_LABELS[item.mediaType] || { label: item.mediaType, className: 'bg-slate-200 text-slate-700' };
              return (
                <li key={item._id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'backwards' }}>
                  <Link
                    to={`/media/${item._id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md hover:scale-[1.01]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate font-medium text-slate-800" title={item.filename}>
                        {item.filename}
                      </p>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${typeInfo.className}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                    <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 text-sm text-slate-600">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
