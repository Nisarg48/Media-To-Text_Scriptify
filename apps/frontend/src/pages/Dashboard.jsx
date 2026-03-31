import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import apiClient from '../api/client';

const STATUS_CONFIG = {
  UPLOADING: { label: 'Uploading', className: 'border border-slate-500/40 bg-slate-700/50 text-slate-200' },
  UPLOADED: { label: 'Queued', className: 'border border-slate-500/40 bg-slate-700/50 text-slate-200' },
  PROCESSING: { label: 'Processing', className: 'border border-amber-500/35 bg-amber-500/15 text-amber-200' },
  COMPLETED: { label: 'Done', className: 'border border-accent/40 bg-accent-muted text-accent' },
  FAILED: { label: 'Failed', className: 'border border-red-500/35 bg-red-500/15 text-red-300' },
};

const MEDIA_TYPE_LABELS = {
  VIDEO: { label: 'Video', className: 'border border-sky-500/35 bg-sky-500/15 text-sky-200' },
  AUDIO: { label: 'Audio', className: 'border border-violet-500/35 bg-violet-500/15 text-violet-200' },
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
    green: 'border-l-accent bg-accent-muted/50',
    amber: 'border-l-amber-400 bg-amber-500/10',
    red: 'border-l-red-400 bg-red-500/10',
    slate: 'border-l-slate-500 bg-surface-muted/80',
    blue: 'border-l-sky-400 bg-sky-500/10',
    violet: 'border-l-violet-400 bg-violet-500/10',
  };
  return (
    <div className={`rounded-xl border border-surface-border border-l-4 bg-surface/90 p-4 shadow-glass backdrop-blur-sm ${accentMap[accent] ?? accentMap.slate}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">{label}</p>
      <p className="mt-2 text-2xl font-bold text-content">{value}</p>
      {sub && <p className="mt-2 text-xs text-content-muted">{sub}</p>}
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
    <div className="relative flex h-full min-h-[5.5rem] flex-col overflow-hidden rounded-xl border border-surface-border border-l-4 border-l-violet-400 bg-violet-500/10 p-4 shadow-glass backdrop-blur-sm">
      <div className={dimmed ? 'pointer-events-none blur-sm opacity-40' : ''}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Plan & quota</p>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${isPro ? 'bg-accent-muted text-accent' : 'bg-surface-muted text-content-muted'}`}>
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>
        <p className={`text-sm font-bold tabular-nums text-content ${mediaDanger ? 'text-red-300' : mediaWarn ? 'text-amber-200' : ''}`}>
          {mediaCount} / {maxMedia} files
        </p>
        <div className="mt-2 h-2 w-full flex-1 overflow-hidden rounded-full bg-canvas/80">
          <div
            className={`h-full rounded-full transition-all duration-500 ${mediaDanger ? 'bg-red-500' : mediaWarn ? 'bg-amber-400' : 'bg-accent'}`}
            style={{ width: `${mediaPct}%` }}
          />
        </div>
        {!isPro && (
          <RouterLink
            to="/dashboard/billing"
            className="mt-2 inline-block w-fit rounded-lg bg-accent px-2 py-1 text-[10px] font-semibold text-accent-foreground shadow-glow-sm hover:brightness-110"
          >
            Upgrade
          </RouterLink>
        )}
        <p className="mt-2 text-[10px] leading-tight text-content-subtle">
          {retentionDays}-day retention per upload (not tied to the dashboard date filter)
        </p>
      </div>
      {dimmed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-canvas/80 px-2 text-center backdrop-blur-sm">
          <p className="text-[11px] font-medium leading-snug text-content-muted">
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
      <div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-muted/60" />
          ))}
        </div>
      </div>
    );
  }
  if (!stats) return null;

  const { totalFiles, byStatus, storageBytesUsed, subscription } = stats;
  const inFlight = (byStatus?.PROCESSING ?? 0) + (byStatus?.UPLOADED ?? 0);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
    <div className="mb-6 rounded-xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Dashboard period</p>
          <p className="mt-2 text-small font-medium text-content">{periodLabel}</p>
          <p className="mt-2 text-xs text-content-subtle">
            {periodScope === 'all'
              ? 'Showing all of your media. Open the date filter to limit by range.'
              : 'Stats and list match the selected range (completed by finish time; in-progress by upload time).'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCloseDateFilterToggle}
            className={`rounded-lg px-4 py-2 text-small font-semibold shadow-sm transition ${
              filterPanelOpen || periodScope === 'range'
                ? 'bg-accent text-accent-foreground shadow-glow-sm hover:brightness-110'
                : 'border border-surface-border bg-surface-muted/80 text-content-muted hover:border-accent/30 hover:text-content'
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
              className="rounded-lg border border-surface-border bg-surface-muted/80 px-4 py-2 text-small font-medium text-content-muted hover:border-accent/30 hover:text-content"
            >
              Clear date filter
            </button>
          )}
        </div>
      </div>

      {filterPanelOpen && (
        <div className="mt-6 border-t border-surface-border pt-6">
          <p className="mb-4 text-xs font-medium text-content-muted">
            Pick a range below. Transcript quota stays hidden until you clear the date filter.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyThisMonth}
              className={`rounded-lg px-4 py-2 text-small font-medium transition ${preset === 'this' && periodScope === 'range' ? 'bg-accent text-accent-foreground shadow-glow-sm' : 'bg-surface-muted text-content-muted hover:bg-surface/80'}`}
            >
              This month
            </button>
            <button
              type="button"
              onClick={applyPrevMonth}
              className={`rounded-lg px-4 py-2 text-small font-medium transition ${preset === 'prev' && periodScope === 'range' ? 'bg-accent text-accent-foreground shadow-glow-sm' : 'bg-surface-muted text-content-muted hover:bg-surface/80'}`}
            >
              Previous month
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-surface-border bg-canvas-elevated px-2 py-2 text-small text-content"
                aria-label="Custom range start"
              />
              <span className="text-content-subtle">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-surface-border bg-canvas-elevated px-2 py-2 text-small text-content"
                aria-label="Custom range end"
              />
              <button
                type="button"
                onClick={applyCustom}
                className={`rounded-lg px-4 py-2 text-small font-medium transition ${preset === 'custom' && periodScope === 'range' ? 'bg-accent text-accent-foreground shadow-glow-sm' : 'bg-surface-muted text-content-muted hover:bg-surface/80'}`}
              >
                Apply range
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={clearAllFiltersAndClosePanel}
            className="mt-4 text-small font-medium text-accent hover:underline"
          >
            Clear all filters & show all activity
          </button>
        </div>
      )}
    </div>
  );

  if (loading && media.length === 0 && !error) {
    return (
      <div className="animate-fade-in space-y-10 pb-10 pt-2">
        {periodToolbar}
        <UsageStats stats={stats} loading={statsLoading} quotaDimmed={quotaDimmed} />
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-content-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
        {error}
      </div>
    );
  }

  if (media.length === 0 && total === 0 && !searchDebounced && statusFilter === 'all') {
    return (
      <div className="animate-fade-in space-y-10 pb-10 pt-2">
        {periodToolbar}
        <UsageStats stats={stats} loading={statsLoading} quotaDimmed={quotaDimmed} />
        <div className="rounded-2xl border border-surface-border bg-surface/90 p-8 text-center shadow-glass backdrop-blur-xl sm:p-12">
          <h2 className="text-h3 font-semibold text-content sm:text-h2">
            {periodScope === 'all' ? 'No media yet' : 'No activity in this period'}
          </h2>
          <p className="mt-4 text-content-muted">
            {periodScope === 'all'
              ? 'Upload your first audio or video to get a transcript.'
              : 'Nothing matches the selected dates. Try another range or clear the date filter.'}
          </p>
          <RouterLink
            to="/dashboard/upload"
            className="mt-8 inline-flex rounded-xl bg-accent px-6 py-3 text-small font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 active:scale-[0.98]"
          >
            Upload media
          </RouterLink>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-10 pb-10 pt-2">
      {periodToolbar}
      <UsageStats stats={stats} loading={statsLoading} quotaDimmed={quotaDimmed} />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h1 className="text-h2 font-bold text-content">Your media</h1>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename…"
              className="min-w-[200px] flex-1 rounded-xl border border-surface-border bg-surface-muted/60 px-4 py-2 text-small text-content shadow-sm outline-none transition placeholder:text-content-subtle focus:border-accent focus:ring-2 focus:ring-accent/25 sm:max-w-xs"
              aria-label="Search media by filename"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-surface-border bg-surface-muted/60 px-4 py-2 text-small text-content outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-xl border border-surface-border bg-surface-muted/50 p-2 shadow-sm" role="group" aria-label="Filter by type">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTypeFilter(opt.value)}
                className={`rounded-lg px-4 py-2 text-small font-medium transition-all duration-200 ${
                  typeFilter === opt.value
                    ? 'bg-surface text-accent ring-1 ring-accent/30'
                    : 'bg-transparent text-content-muted hover:bg-surface/80 hover:text-content'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {total > 0 && (
            <p className="text-small text-content-muted">
              {total} item{total !== 1 ? 's' : ''}
              {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
            </p>
          )}
        </div>
      </div>

      {filteredMedia.length === 0 ? (
        <div className="rounded-2xl border border-surface-border bg-surface/90 p-8 text-center shadow-glass">
          <p className="text-content-muted">
            No media matches your filters.
            {(searchDebounced || statusFilter !== 'all' || typeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="ml-2 font-medium text-accent hover:underline"
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      ) : (
        <>
          {loading && media.length > 0 && (
            <p className="mb-2 text-center text-xs text-content-subtle" aria-live="polite">
              Updating…
            </p>
          )}
          <ul className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${loading && media.length > 0 ? 'opacity-70' : ''}`}>
            {filteredMedia.map((item, i) => {
              const statusInfo = STATUS_CONFIG[item.status] || { label: item.status, className: 'border border-slate-500/40 bg-slate-700/50 text-slate-200' };
              const typeInfo = MEDIA_TYPE_LABELS[item.mediaType] || { label: item.mediaType, className: 'border border-slate-500/40 bg-slate-700/50 text-slate-200' };
              return (
                <li key={item._id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'backwards' }}>
                  <RouterLink
                    to={`/media/${item._id}`}
                    className="block rounded-xl border border-surface-border bg-surface/90 p-4 shadow-glass backdrop-blur-sm transition hover:border-accent/40 hover:shadow-glow-sm hover:scale-[1.01]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate font-medium text-content" title={item.filename}>
                        {item.filename}
                      </p>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${typeInfo.className}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-content-subtle">{formatDate(item.createdAt)}</p>
                    <span className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-medium ${statusInfo.className}`}>
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
                className="rounded-lg border border-surface-border bg-surface-muted/80 px-4 py-2 text-small font-medium text-content-muted transition hover:border-accent/30 hover:text-content disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 text-small text-content-muted">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-surface-border bg-surface-muted/80 px-4 py-2 text-small font-medium text-content-muted transition hover:border-accent/30 hover:text-content disabled:cursor-not-allowed disabled:opacity-50"
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
