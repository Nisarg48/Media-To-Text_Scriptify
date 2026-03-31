import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

const ROLE_CONFIG = {
    admin:  { label: 'Admin',  cls: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30' },
    worker: { label: 'Worker', cls: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30' },
    user:   { label: 'User',   cls: 'bg-surface-muted text-content-muted ring-1 ring-surface-border' },
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
        'bg-sky-600', 'bg-violet-600', 'bg-cyan-600',
        'bg-amber-600', 'bg-rose-600', 'bg-teal-600',
    ];
    const color = colors[(name?.charCodeAt(0) || 0) % colors.length];

    return (
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}>
            {initials}
        </span>
    );
}

function TableSkeleton() {
    return [...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-surface-border">
            <td className="px-4 py-3">
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-surface-muted/60" />
                    <div className="space-y-2">
                        <div className="h-4 w-28 animate-pulse rounded bg-surface-muted/60" />
                        <div className="h-3 w-36 animate-pulse rounded bg-surface-muted/60" />
                    </div>
                </div>
            </td>
            {[70, 60, 60, 80, 80].map((w, j) => (
                <td key={j} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-surface-muted/60" style={{ width: w }} />
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
        <div className="animate-fade-in space-y-6">
            <div>
                <h1 className="text-h3 font-bold text-content sm:text-h2">Users</h1>
                <p className="mt-2 text-small text-content-muted">
                    {loading ? 'Loading…' : `${users.length} registered`}
                </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or email…"
                        className="w-full rounded-xl border border-surface-border bg-surface-muted/50 py-2 pl-8 pr-4 text-small text-content outline-none transition placeholder:text-content-subtle focus:border-accent focus:ring-2 focus:ring-accent/25"
                    />
                </div>

                <div className="flex gap-2 rounded-xl border border-surface-border bg-surface-muted/40 p-2 shadow-sm">
                    {['all', 'admin', 'worker', 'user'].map((r) => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => setRoleFilter(r)}
                            className={`rounded-lg px-4 py-2 text-xs font-semibold capitalize transition-all duration-150 ${
                                roleFilter === r
                                    ? 'bg-accent text-accent-foreground shadow-glow-sm'
                                    : 'text-content-muted hover:bg-surface hover:text-content'
                            }`}
                        >
                            {r === 'all' ? 'All roles' : r}
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
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">User</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Role</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Media</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Last login</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Joined</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                            {loading ? (
                                <TableSkeleton />
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-content-subtle">
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
                                            className="animate-fade-in-up group transition-colors hover:bg-surface-muted/30"
                                            style={{ animationDelay: `${i * 0.03}s`, animationFillMode: 'backwards' }}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-4">
                                                    <Avatar name={u.name} />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-content">{u.name}</p>
                                                        <p className="truncate text-xs text-content-subtle">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${rc.cls}`}>
                                                    {rc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-content-muted">
                                                <span className="font-medium">{u.activeMediaCount}</span>
                                                <span className="text-xs text-content-subtle"> / {u.mediaCount}</span>
                                            </td>
                                            <td className="px-4 py-3 text-content-subtle">
                                                {formatDateTime(u.lastLogin)}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-content-subtle">
                                                {formatDate(u.createdAt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    to={`/admin/media?userId=${u._id}&userName=${encodeURIComponent(u.name)}`}
                                                    className="text-xs font-medium text-accent transition-colors hover:brightness-125"
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
                    <div className="border-t border-surface-border px-4 py-4">
                        <p className="text-xs text-content-subtle">
                            Showing {filtered.length} of {users.length} users
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
