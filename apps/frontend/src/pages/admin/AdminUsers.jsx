import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

const ROLE_CONFIG = {
    admin:  { label: 'Admin',  cls: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200' },
    worker: { label: 'Worker', cls: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
    user:   { label: 'User',   cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
};

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, { dateStyle: 'short' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { dateStyle: 'short' });
}

function Avatar({ name }) {
    const initials = (name || '?')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const colors = [
        'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
        'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
    ];
    const color = colors[(name?.charCodeAt(0) || 0) % colors.length];

    return (
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}>
            {initials}
        </span>
    );
}

function TableSkeleton() {
    return [...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 animate-pulse rounded-full bg-slate-100" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
                    </div>
                </div>
            </td>
            {[70, 60, 60, 80, 80].map((w, j) => (
                <td key={j} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: w }} />
                </td>
            ))}
        </tr>
    ));
}

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    useEffect(() => {
        apiClient
            .get('/admin/users')
            .then((res) => setUsers(res.data.users || []))
            .catch((err) => setError(err.response?.data?.msg || 'Failed to load users'))
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let list = users;
        if (roleFilter !== 'all') list = list.filter((u) => (u.role || 'user') === roleFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [users, search, roleFilter]);

    return (
        <div className="animate-fade-in space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Users</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                    {loading ? 'Loading…' : `${users.length} registered`}
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or email…"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                    />
                </div>

                <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
                    {['all', 'admin', 'worker', 'user'].map((r) => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => setRoleFilter(r)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all duration-150 ${
                                roleFilter === r
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm'
                            }`}
                        >
                            {r === 'all' ? 'All roles' : r}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[580px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">User</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Media</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Last login</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Joined</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <TableSkeleton />
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        {search || roleFilter !== 'all' ? 'No users match your filters' : 'No users yet'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((u, i) => {
                                    const role = u.role || 'user';
                                    const rc = ROLE_CONFIG[role] || ROLE_CONFIG.user;
                                    return (
                                        <tr
                                            key={u._id}
                                            className="animate-fade-in-up group transition-colors hover:bg-slate-50/80"
                                            style={{ animationDelay: `${i * 0.03}s`, animationFillMode: 'backwards' }}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar name={u.name} />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-slate-700">{u.name}</p>
                                                        <p className="truncate text-xs text-slate-400">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${rc.cls}`}>
                                                    {rc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-slate-500">
                                                <span className="font-medium">{u.activeMediaCount}</span>
                                                <span className="text-xs text-slate-400"> / {u.mediaCount}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400">
                                                {formatDateTime(u.lastLogin)}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-slate-400">
                                                {formatDate(u.createdAt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    to={`/admin/media?userId=${u._id}&userName=${encodeURIComponent(u.name)}`}
                                                    className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                                                >
                                                    View media →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filtered.length > 0 && (
                    <div className="border-t border-slate-100 px-4 py-3">
                        <p className="text-xs text-slate-400">
                            Showing {filtered.length} of {users.length} users
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
