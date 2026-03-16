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
        <tr key={i} className="border-b border-slate-100">
            {[200, 120, 80, 160, 100, 90].map((w, j) => (
                <td key={j} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: w }} />
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
        <div className="animate-fade-in space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Jobs</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                    {loading ? 'Loading…' : `${failedCount} failed · ${processingCount} processing`}
                </p>
            </div>

            {/* Summary chips */}
            {!loading && (failedCount > 0 || processingCount > 0) && (
                <div className="flex flex-wrap gap-3">
                    {failedCount > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                            <span className="h-2 w-2 rounded-full bg-red-400" />
                            <span className="text-sm font-medium text-red-700">{failedCount} failed job{failedCount !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                    {processingCount > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                            <span className="text-sm font-medium text-amber-700">{processingCount} still processing</span>
                        </div>
                    )}
                </div>
            )}

            {/* Filter */}
            <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
                {['all', 'FAILED', 'PROCESSING'].map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                            filter === f
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm'
                        }`}
                    >
                        {f === 'all' ? 'All' : f === 'FAILED' ? 'Failed' : 'Processing'}
                    </button>
                ))}
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Filename</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Owner</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Error</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Stage</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <TableSkeleton />
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        {jobs.length === 0
                                            ? 'No active jobs — all clear!'
                                            : 'No jobs match the current filter'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((job, i) => (
                                    <tr
                                        key={job._id}
                                        className="animate-fade-in-up group transition-colors hover:bg-slate-50/80"
                                        style={{ animationDelay: `${i * 0.03}s`, animationFillMode: 'backwards' }}
                                    >
                                        <td className="max-w-[200px] px-4 py-3">
                                            <Link
                                                to={`/admin/media/${job._id}`}
                                                className="block truncate font-medium text-slate-700 transition-colors hover:text-emerald-600"
                                                title={job.filename}
                                            >
                                                {job.filename}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {job.mediaUploadedBy?.name || <span className="italic text-slate-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {job.status === 'FAILED' ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                                    Failed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                                                    Processing
                                                </span>
                                            )}
                                        </td>
                                        <td className="max-w-[220px] px-4 py-3">
                                            {job.errorDetails?.message ? (
                                                <span className="line-clamp-2 text-xs leading-relaxed text-red-600" title={job.errorDetails.message}>
                                                    {job.errorDetails.message}
                                                </span>
                                            ) : (
                                                <span className="text-xs italic text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {job.errorDetails?.stage ? (
                                                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                                                    {job.errorDetails.stage}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 tabular-nums text-slate-400">
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
