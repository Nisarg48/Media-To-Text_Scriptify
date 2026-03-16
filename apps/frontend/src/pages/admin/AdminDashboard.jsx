import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useCountUp } from '../../utils/useCountUp';

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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

const STATUS_CONFIG = {
    UPLOADING:  { label: 'Uploading',   cls: 'bg-slate-100 text-slate-600' },
    UPLOADED:   { label: 'Queued',      cls: 'bg-slate-100 text-slate-600' },
    PROCESSING: { label: 'Processing',  cls: 'bg-amber-100 text-amber-700' },
    COMPLETED:  { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700' },
    FAILED:     { label: 'Failed',      cls: 'bg-red-100 text-red-600' },
};

function StatCard({ icon, label, value, sub, iconBg, delay = 0 }) {
    const count = useCountUp(typeof value === 'number' ? value : 0, 900);
    return (
        <div
            className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            style={{ animationDelay: `${delay}s`, animationFillMode: 'backwards' }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-slate-800">
                        {typeof value === 'number' ? count.toLocaleString() : value}
                    </p>
                    {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function SkeletonRow() {
    return (
        <tr>
            {[...Array(5)].map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="h-4 rounded bg-slate-100" style={{ width: i === 0 ? '70%' : '50%' }} />
                </td>
            ))}
        </tr>
    );
}

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        apiClient
            .get('/admin/stats')
            .then((res) => setStats(res.data))
            .catch((err) => setError(err.response?.data?.msg || 'Failed to load stats'))
            .finally(() => setLoading(false));
    }, []);

    if (error) {
        return (
            <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-7">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Overview</h1>
                <p className="mt-0.5 text-sm text-slate-500">System health at a glance</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    delay={0}
                    label="Total Users"
                    value={loading ? '—' : stats?.totalUsers ?? 0}
                    iconBg="bg-blue-50"
                    icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-500">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                        </svg>
                    }
                />
                <StatCard
                    delay={0.06}
                    label="Total Media"
                    value={loading ? '—' : stats?.totalMedia ?? 0}
                    sub={loading ? '' : `${stats?.activeMedia ?? 0} active · ${stats?.deletedMedia ?? 0} deleted`}
                    iconBg="bg-violet-50"
                    icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-violet-500">
                            <path d="M15 10l4.553-2.276A1 1 0 0121 8.724v6.552a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                    }
                />
                <StatCard
                    delay={0.12}
                    label="Failed Jobs"
                    value={loading ? '—' : stats?.failedMedia ?? 0}
                    sub={loading ? '' : `${stats?.processingMedia ?? 0} still processing`}
                    iconBg="bg-red-50"
                    icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-red-500">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                    }
                />
                <StatCard
                    delay={0.18}
                    label="Storage Used"
                    value={loading ? '—' : formatBytes(stats?.totalStorageBytes)}
                    sub={loading ? '' : `${stats?.totalTranscripts ?? 0} transcripts`}
                    iconBg="bg-emerald-50"
                    icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-500">
                            <ellipse cx="12" cy="5" rx="9" ry="3" />
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                    }
                />
            </div>

            {/* Recent uploads */}
            <div
                className="animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                style={{ animationDelay: '0.24s', animationFillMode: 'backwards' }}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h2 className="text-base font-semibold text-slate-800">Recent uploads</h2>
                    <Link
                        to="/admin/media"
                        className="text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                    >
                        View all →
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Filename</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Owner</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Uploaded</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading
                                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                                : (stats?.recentUploads || []).map((item, i) => {
                                    const sc = STATUS_CONFIG[item.status] || { label: item.status, cls: 'bg-slate-100 text-slate-600' };
                                    return (
                                        <tr
                                            key={item._id}
                                            className="group transition-colors hover:bg-slate-50/80"
                                            style={{ animationDelay: `${0.3 + i * 0.04}s` }}
                                        >
                                            <td className="px-4 py-3">
                                                <Link
                                                    to={`/admin/media/${item._id}`}
                                                    className="max-w-[200px] truncate font-medium text-slate-700 transition-colors hover:text-emerald-600 group-hover:underline"
                                                    title={item.filename}
                                                >
                                                    {item.filename}
                                                </Link>
                                                {item.deletedAt && (
                                                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">deleted</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {item.mediaUploadedBy?.name || <span className="italic text-slate-400">unknown</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${item.mediaType === 'VIDEO' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                                                    {item.mediaType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 tabular-nums">
                                                {formatDate(item.createdAt)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            {!loading && (stats?.recentUploads || []).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        No uploads yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
