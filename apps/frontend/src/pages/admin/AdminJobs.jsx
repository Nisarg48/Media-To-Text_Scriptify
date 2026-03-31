import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString(undefined, { dateStyle: 'short' });
}

function TableSkeleton() {
    return [...Array(5)].map((_, i) => (
        <tr key={i} className="border-b border-surface-border">
            {[200, 120, 80, 160, 100, 90].map((w, j) => (
                <td key={j} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-surface-muted/60" style={{ width: w }} />
                </td>
            ))}
        </tr>
    ));
}

export default function AdminJobs() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        apiClient
            .get('/admin/jobs')
            .then((res) => setJobs(res.data.jobs || []))
            .catch((err) => setError(err.response?.data?.msg || 'Failed to load jobs'))
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);
    const failedCount = jobs.filter((j) => j.status === 'FAILED').length;
    const processingCount = jobs.filter((j) => j.status === 'PROCESSING').length;

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h1 className="text-h3 font-bold text-content sm:text-h2">Jobs</h1>
                <p className="mt-2 text-small text-content-muted">
                    {loading ? 'Loading…' : `${failedCount} failed · ${processingCount} processing`}
                </p>
            </div>

            {!loading && (failedCount > 0 || processingCount > 0) && (
                <div className="flex flex-wrap gap-4">
                    {failedCount > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
                            <span className="h-2 w-2 rounded-full bg-red-400" />
                            <span className="text-small font-medium text-red-200">{failedCount} failed job{failedCount !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                    {processingCount > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                            <span className="text-small font-medium text-amber-200">{processingCount} still processing</span>
                        </div>
                    )}
                </div>
            )}

            <div className="flex w-fit gap-2 rounded-xl border border-surface-border bg-surface-muted/40 p-2 shadow-sm">
                {['all', 'FAILED', 'PROCESSING'].map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150 ${
                            filter === f
                                ? 'bg-accent text-accent-foreground shadow-glow-sm'
                                : 'text-content-muted hover:bg-surface hover:text-content'
                        }`}
                    >
                        {f === 'all' ? 'All' : f === 'FAILED' ? 'Failed' : 'Processing'}
                    </button>
                ))}
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-small text-red-200">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface/90 shadow-glass backdrop-blur-xl">
                <div className="overflow-x-auto">
                    <table className="admin-data-table w-full min-w-[560px] text-small">
                        <thead>
                            <tr className="border-b border-surface-border">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Filename</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Owner</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Error</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Stage</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                            {loading ? (
                                <TableSkeleton />
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-content-subtle">
                                        {jobs.length === 0
                                            ? 'No active jobs — all clear!'
                                            : 'No jobs match the current filter'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((job, i) => (
                                    <tr
                                        key={job._id}
                                        className="animate-fade-in-up group transition-colors hover:bg-surface-muted/30"
                                        style={{ animationDelay: `${i * 0.03}s`, animationFillMode: 'backwards' }}
                                    >
                                        <td className="max-w-[200px] px-4 py-3">
                                            <Link
                                                to={`/admin/media/${job._id}`}
                                                className="block truncate font-medium text-content transition-colors hover:text-accent"
                                                title={job.filename}
                                            >
                                                {job.filename}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-content-muted">
                                            {job.mediaUploadedBy?.name || <span className="italic text-content-subtle">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {job.status === 'FAILED' ? (
                                                <span className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200">
                                                    <span className="h-2 w-2 rounded-full bg-red-400" />
                                                    Failed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200">
                                                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                                                    Processing
                                                </span>
                                            )}
                                        </td>
                                        <td className="max-w-[220px] px-4 py-3">
                                            {job.errorDetails?.message ? (
                                                <span className="line-clamp-2 text-xs leading-relaxed text-red-300" title={job.errorDetails.message}>
                                                    {job.errorDetails.message}
                                                </span>
                                            ) : (
                                                <span className="text-xs italic text-content-subtle">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {job.errorDetails?.stage ? (
                                                <span className="rounded-md bg-surface-muted px-2 py-1 font-mono text-xs text-content-muted">
                                                    {job.errorDetails.stage}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-content-subtle">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 tabular-nums text-content-subtle">
                                            {formatDate(job.updatedAt)}
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
