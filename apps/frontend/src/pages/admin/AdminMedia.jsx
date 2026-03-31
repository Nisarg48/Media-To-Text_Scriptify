import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../../api/client';

const STATUS_OPTIONS = [
    { value: 'all',        label: 'All',        deleted: undefined, status: undefined },
    { value: 'active',     label: 'Active',     deleted: 'false',   status: undefined },
    { value: 'COMPLETED',  label: 'Completed',  deleted: 'false',   status: 'COMPLETED' },
    { value: 'PROCESSING', label: 'Processing', deleted: 'false',   status: 'PROCESSING' },
    { value: 'FAILED',     label: 'Failed',     deleted: 'false',   status: 'FAILED' },
    { value: 'deleted',    label: 'Deleted',    deleted: 'true',    status: undefined },
];

const STATUS_BADGE = {
    UPLOADING:  'border border-slate-500/40 bg-slate-700/50 text-slate-200',
    UPLOADED:   'border border-slate-500/40 bg-slate-700/50 text-slate-200',
    PROCESSING: 'border border-amber-500/35 bg-amber-500/15 text-amber-200',
    COMPLETED:  'border border-accent/40 bg-accent-muted text-accent',
    FAILED:     'border border-red-500/35 bg-red-500/15 text-red-300',
};

const STATUS_LABEL = {
    UPLOADING: 'Uploading', UPLOADED: 'Queued',
    PROCESSING: 'Processing', COMPLETED: 'Completed', FAILED: 'Failed',
};

function formatBytes(bytes) {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' +
           new Date(dateStr).toLocaleTimeString(undefined, { timeStyle: 'short' });
}

function TableSkeleton() {
    return [...Array(8)].map((_, i) => (
        <tr key={i} className="border-b border-surface-border">
            {[200, 120, 70, 80, 80, 120].map((w, j) => (
                <td key={j} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-surface-muted/60" style={{ width: w }} />
                </td>
            ))}
        </tr>
    ));
}

export default function AdminMedia() {
    const [searchParams] = useSearchParams();

    const [media, setMedia] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [page, setPage] = useState(1);

    // User filter — seeded from URL on first render
    const [userId, setUserId] = useState(() => searchParams.get('userId') || '');
    const [userName, setUserName] = useState(() => searchParams.get('userName') || '');

    const LIMIT = 20;
    const debounceRef = useRef(null);

    const fetchMedia = useCallback((params) => {
        setLoading(true);
        setError('');

        const opt = STATUS_OPTIONS.find((o) => o.value === params.statusFilter) || STATUS_OPTIONS[0];
        const q = new URLSearchParams();
        if (opt.status)              q.set('status', opt.status);
        if (opt.deleted !== undefined) q.set('deleted', opt.deleted);
        if (params.typeFilter !== 'all') q.set('type', params.typeFilter);
        if (params.search)           q.set('search', params.search);
        if (params.userId)           q.set('userId', params.userId);
        q.set('page', params.page);
        q.set('limit', LIMIT);

        apiClient
            .get(`/admin/media?${q.toString()}`)
            .then((res) => {
                setMedia(res.data.media || []);
                setTotal(res.data.total || 0);
            })
            .catch((err) => setError(err.response?.data?.msg || 'Failed to load media'))
            .finally(() => setLoading(false));
    }, []);

    // Re-fetch when filters/search change (debounced)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            fetchMedia({ search, statusFilter, typeFilter, userId, page: 1 });
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [search, statusFilter, typeFilter, userId, fetchMedia]);

    // Re-fetch when page changes (not debounced)
    useEffect(() => {
        fetchMedia({ search, statusFilter, typeFilter, userId, page }); // eslint-disable-line react-hooks/set-state-in-effect -- intentional fetch on page change
    }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    const totalPages = Math.ceil(total / LIMIT);

    const clearUserFilter = () => {
        setUserId('');
        setUserName('');
        setPage(1);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h1 className="text-h3 font-bold text-content sm:text-h2">Media</h1>
                <p className="mt-2 text-small text-content-muted">
                    {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''}`}
                </p>
            </div>

            {userId && (
                <div className="animate-fade-in flex items-center justify-between gap-4 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3">
                    <div className="flex items-center gap-2 text-small text-sky-200">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>
                            Showing media for{' '}
                            <strong className="font-semibold">{userName || userId}</strong>
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={clearUserFilter}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Clear filter
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search filename…"
                        className="w-full rounded-xl border border-surface-border bg-surface-muted/50 py-2 pl-8 pr-4 text-small text-content outline-none transition placeholder:text-content-subtle focus:border-accent focus:ring-2 focus:ring-accent/25"
                    />
                </div>

                <div className="flex flex-wrap gap-2 rounded-xl border border-surface-border bg-surface-muted/40 p-2 shadow-sm">
                    {STATUS_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                                statusFilter === opt.value
                                    ? 'bg-accent text-accent-foreground shadow-glow-sm'
                                    : 'text-content-muted hover:bg-surface hover:text-content'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 rounded-xl border border-surface-border bg-surface-muted/40 p-2 shadow-sm">
                    {['all', 'VIDEO', 'AUDIO'].map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => { setTypeFilter(t); setPage(1); }}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                                typeFilter === t
                                    ? 'bg-accent text-accent-foreground shadow-glow-sm'
                                    : 'text-content-muted hover:bg-surface hover:text-content'
                            }`}
                        >
                            {t === 'all' ? 'All types' : t === 'VIDEO' ? 'Video' : 'Audio'}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-small text-red-200">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface/90 shadow-glass backdrop-blur-xl">
                <div className="overflow-x-auto">
                    <table className="admin-data-table w-full min-w-[580px] text-small">
                        <thead>
                            <tr className="border-b border-surface-border">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Filename</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Owner</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Size</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                            {loading ? (
                                <TableSkeleton />
                            ) : media.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-content-subtle">
                                        {userId ? `No media for this user` : 'No media found'}
                                    </td>
                                </tr>
                            ) : (
                                media.map((item, i) => {
                                    const sc = STATUS_BADGE[item.status] || 'border border-slate-500/40 bg-slate-700/50 text-slate-200';
                                    const sl = STATUS_LABEL[item.status] || item.status;
                                    return (
                                        <tr
                                            key={item._id}
                                            className="animate-fade-in-up group transition-colors hover:bg-surface-muted/30"
                                            style={{ animationDelay: `${i * 0.03}s`, animationFillMode: 'backwards' }}
                                        >
                                            <td className="max-w-[200px] px-4 py-3">
                                                <Link
                                                    to={`/admin/media/${item._id}`}
                                                    className="block truncate font-medium text-content transition-colors hover:text-accent"
                                                    title={item.filename}
                                                >
                                                    {item.filename}
                                                </Link>
                                                {item.deletedAt && (
                                                    <span className="mt-0.5 inline-block rounded bg-red-500/20 px-2 py-1 text-xs text-red-300">
                                                        deleted
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-content-muted">
                                                <span title={item.mediaUploadedBy?.email}>
                                                    {item.mediaUploadedBy?.name || <span className="italic text-content-subtle">—</span>}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-md px-2 py-1 text-xs font-medium ${item.mediaType === 'VIDEO' ? 'border border-sky-500/35 bg-sky-500/15 text-sky-200' : 'border border-violet-500/35 bg-violet-500/15 text-violet-200'}`}>
                                                    {item.mediaType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-md px-2 py-1 text-xs font-medium ${sc}`}>{sl}</span>
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-content-subtle">
                                                {formatBytes(item.sizeBytes)}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-content-subtle">
                                                {formatDate(item.createdAt)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-surface-border px-4 py-4">
                        <p className="text-xs text-content-subtle">
                            Page {page} of {totalPages} &middot; {total} records
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                                className="rounded-lg border border-surface-border px-6 py-2 text-xs font-medium text-content-muted transition-colors hover:border-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                ← Prev
                            </button>
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="rounded-lg border border-surface-border px-6 py-2 text-xs font-medium text-content-muted transition-colors hover:border-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
