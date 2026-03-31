import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
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

function localMonthRange(monthOffset = 0) {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() + monthOffset, 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + monthOffset + 1, 1, 0, 0, 0, 0);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

function localRangeFromDateInputs(fromYmd, toYmd) {
  const [sy, sm, sd] = fromYmd.split('-').map(Number);
  const [ey, em, ed] = toYmd.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  const end = new Date(ey, em - 1, ed + 1, 0, 0, 0, 0);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

function formatPeriodRangeLabel(periodStart, periodEnd) {
  const s = new Date(periodStart);
  const e = new Date(periodEnd);
  const last = new Date(e.getTime() - 86400000);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  return `${s.toLocaleDateString(undefined, { dateStyle: 'medium' })} – ${last.toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
}

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

function isCanceledError(err) {
  return axios.isCancel(err) || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';
}

function StatCard({ label, value, sub, accent }) {
  const accentMap = {
    green: 'border-l-emerald-400 bg-emerald-50',
    amber: 'border-l-amber-400 bg-amber-50',
    red: 'border-l-red-400 bg-red-50',
    slate: 'border-l-slate-300 bg-slate-50',
    blue: 'border-l-blue-400 bg-blue-50',
    violet: 'border-l-violet-400 bg-violet-50',
  };
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${accentMap[accent] ?? accentMap.slate}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function QuotaStatCard({ subscription, dimmed }) {
  const mediaCount = subscription?.mediaCount ?? 0;
  const maxMedia = subscription?.maxMediaCount ?? 3;
  const mediaPct = maxMedia > 0 ? Math.min(100, Math.round((mediaCount / maxMedia) * 100)) : 0;
  const mediaDanger = mediaPct >= 90;
  const mediaWarn = mediaPct >= 70;
  const isPro = subscription?.plan === 'pro';
  const retentionDays = subscription?.retentionDays ?? 15;

  return (
    <div className="relative flex h-full min-h-[5.5rem] flex-col overflow-hidden rounded-xl border border-slate-200 border-l-4 border-l-violet-400 bg-violet-50/80 p-4 shadow-sm">
      <div className={dimmed ? 'pointer-events-none blur-sm opacity-40' : ''}>
        <div className="mb-1 flex items-center justify-between gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan & quota</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isPro ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>
        <p className={`text-sm font-bold tabular-nums text-slate-800 ${mediaDanger ? 'text-red-700' : mediaWarn ? 'text-amber-800' : ''}`}>
          {mediaCount} / {maxMedia} files
        </p>
        <div className="mt-2 h-2 w-full flex-1 overflow-hidden rounded-full bg-white/80">
          <div
            className={`h-full rounded-full transition-all duration-500 ${mediaDanger ? 'bg-red-500' : mediaWarn ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${mediaPct}%` }}
          />
        </div>
        {!isPro && (
          <RouterLink
            to="/dashboard/billing"
            className="mt-2 inline-block w-fit rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white shadow hover:bg-emerald-600"
          >
            Upgrade
          </RouterLink>
        )}
        <p className="mt-1 text-[10px] leading-tight text-slate-400">
          {retentionDays}-day retention per upload (not tied to the dashboard date filter)
        </p>
      </div>
      {dimmed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 px-2 text-center">
          <p className="text-[11px] font-medium leading-snug text-slate-600">
            Quota applies to billing, not the date filter. Clear the date filter to view.
          </p>
        </div>
      )}
    </div>
  );
}

function UsageStats({ stats, loading, quotaDimmed }) {
  if (loading) {
    return (
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }
  if (!stats) return null;

  const { totalFiles, byStatus, storageBytesUsed, subscription } = stats;
  const inFlight = (byStatus?.PROCESSING ?? 0) + (byStatus?.UPLOADED ?? 0);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total files" value={totalFiles} accent="slate" />
        <StatCard label="Completed" value={byStatus?.COMPLETED ?? 0} accent="green" />
        <StatCard label="In progress" value={inFlight} sub={inFlight > 0 ? 'Queued / processing' : undefined} accent="amber" />
        <StatCard label="Failed" value={byStatus?.FAILED ?? 0} accent="red" />
        <StatCard label="Storage used" value={formatBytes(storageBytesUsed)} accent="blue" />
        <QuotaStatCard subscription={subscription} dimmed={quotaDimmed} />
      </div>
    </div>
  );
}

function buildAnalyticsParams(periodScope, periodStart, periodEnd) {
  if (periodScope === 'all') {
    return { periodScope: 'all' };
  }
  return { periodScope: 'range', periodStart, periodEnd };
}

export default function Dashboard() {
  const initialRange = useMemo(() => localMonthRange(0), []);
  const [periodScope, setPeriodScope] = useState('all');
  const [periodStart, setPeriodStart] = useState(initialRange.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initialRange.periodEnd);
  const [preset, setPreset] = useState('this');
  const [customFrom, setCustomFrom] = useState(() => toYmd(new Date()));
  const [customTo, setCustomTo] = useState(() => toYmd(new Date()));
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

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

  const mediaRequestId = useRef(0);

  const quotaDimmed = periodScope === 'range';

  const clearAllFiltersAndClosePanel = useCallback(() => {
    setFilterPanelOpen(false);
    setPeriodScope('all');
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
  }, []);

  const applyThisMonth = useCallback(() => {
    const r = localMonthRange(0);
    setPeriodStart(r.periodStart);
    setPeriodEnd(r.periodEnd);
    setPreset('this');
    setPeriodScope('range');
    setFilterPanelOpen(false);
  }, []);

  const applyPrevMonth = useCallback(() => {
    const r = localMonthRange(-1);
    setPeriodStart(r.periodStart);
    setPeriodEnd(r.periodEnd);
    setPreset('prev');
    setPeriodScope('range');
    setFilterPanelOpen(false);
  }, []);

  const applyCustom = useCallback(() => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    const r = localRangeFromDateInputs(customFrom, customTo);
    setPeriodStart(r.periodStart);
    setPeriodEnd(r.periodEnd);
    setPreset('custom');
    setPeriodScope('range');
    setFilterPanelOpen(false);
  }, [customFrom, customTo]);

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      if (!ac.signal.aborted) setStatsLoading(true);
    });
    const params = buildAnalyticsParams(periodScope, periodStart, periodEnd);
    apiClient
      .get('/analytics/me', { params, signal: ac.signal })
      .then(({ data }) => setStats(data))
      .catch((err) => {
        if (!isCanceledError(err)) setStats(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setStatsLoading(false);
      });
    return () => ac.abort();
  }, [periodScope, periodStart, periodEnd]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ac = new AbortController();
    const id = ++mediaRequestId.current;
    queueMicrotask(() => {
      if (!ac.signal.aborted && id === mediaRequestId.current) {
        setLoading(true);
        setError('');
      }
    });
    const params = {
      page,
      limit: PAGE_SIZE,
      ...buildAnalyticsParams(periodScope, periodStart, periodEnd),
      ...(searchDebounced ? { q: searchDebounced } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    };
    apiClient
      .get('/media', { params, signal: ac.signal })
      .then(({ data }) => {
        if (id !== mediaRequestId.current) return;
        setMedia(data.media || []);
        setTotal(typeof data.total === 'number' ? data.total : (data.media || []).length);
      })
      .catch((err) => {
        if (isCanceledError(err)) return;
        if (id !== mediaRequestId.current) return;
        setError(err.response?.data?.message || err.response?.data?.msg || 'Failed to load media.');
      })
      .finally(() => {
        if (ac.signal.aborted || id !== mediaRequestId.current) return;
        setLoading(false);
      });
    return () => ac.abort();
  }, [page, searchDebounced, statusFilter, periodScope, periodStart, periodEnd]);

  useEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [searchDebounced, statusFilter, periodScope, periodStart, periodEnd]);

  const filteredMedia = useMemo(() => {
    if (typeFilter === 'all') return media;
    return media.filter((m) => m.mediaType === typeFilter);
  }, [media, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const periodLabel = useMemo(() => {
    if (periodScope === 'all') return 'All activity';
    if (stats?.period?.start && stats?.period?.end) {
      return formatPeriodRangeLabel(stats.period.start, stats.period.end);
    }
    return formatPeriodRangeLabel(periodStart, periodEnd);
  }, [periodScope, stats, periodStart, periodEnd]);

  const handleCloseDateFilterToggle = () => {
    if (filterPanelOpen) {
      clearAllFiltersAndClosePanel();
    } else {
      setFilterPanelOpen(true);
    }
  };

  const periodToolbar = (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Dashboard period</p>
          <p className="mt-0.5 text-sm font-medium text-slate-800">{periodLabel}</p>
          <p className="mt-1 text-xs text-slate-400">
            {periodScope === 'all'
              ? 'Showing all of your media. Open the date filter to limit by range.'
              : 'Stats and list match the selected range (completed by finish time; in-progress by upload time).'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCloseDateFilterToggle}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
              filterPanelOpen || periodScope === 'range'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {filterPanelOpen ? 'Close & clear filters' : 'Date filter'}
          </button>
          {periodScope === 'range' && !filterPanelOpen && (
            <button
              type="button"
              onClick={() => {
                setPeriodScope('all');
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear date filter
            </button>
          )}
        </div>
      </div>

      {filterPanelOpen && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-medium text-slate-500">
            Pick a range below. Transcript quota stays hidden until you clear the date filter.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyThisMonth}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${preset === 'this' && periodScope === 'range' ? 'bg-emerald-500 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              This month
            </button>
            <button
              type="button"
              onClick={applyPrevMonth}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${preset === 'prev' && periodScope === 'range' ? 'bg-emerald-500 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Previous month
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                aria-label="Custom range start"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                aria-label="Custom range end"
              />
              <button
                type="button"
                onClick={applyCustom}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${preset === 'custom' && periodScope === 'range' ? 'bg-emerald-500 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Apply range
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={clearAllFiltersAndClosePanel}
            className="mt-3 text-sm font-medium text-emerald-700 hover:underline"
          >
            Clear all filters & show all activity
          </button>
        </div>
      )}
    </div>
  );

  if (loading && media.length === 0 && !error) {
    return (
      <div className="animate-fade-in pb-8 pt-1">
        {periodToolbar}
        <UsageStats stats={stats} loading={statsLoading} quotaDimmed={quotaDimmed} />
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
        {periodToolbar}
        <UsageStats stats={stats} loading={statsLoading} quotaDimmed={quotaDimmed} />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg sm:p-12">
          <h2 className="text-xl font-semibold text-slate-800 sm:text-2xl">
            {periodScope === 'all' ? 'No media yet' : 'No activity in this period'}
          </h2>
          <p className="mt-2 text-slate-600">
            {periodScope === 'all'
              ? 'Upload your first audio or video to get a transcript.'
              : 'Nothing matches the selected dates. Try another range or clear the date filter.'}
          </p>
          <RouterLink
            to="/dashboard/upload"
            className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            Upload media
          </RouterLink>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-8 pt-1">
      {periodToolbar}
      <UsageStats stats={stats} loading={statsLoading} quotaDimmed={quotaDimmed} />

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
                  <RouterLink
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
                  </RouterLink>
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
