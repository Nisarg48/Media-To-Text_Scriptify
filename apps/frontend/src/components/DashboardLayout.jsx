import { Link, Outlet, useLocation } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';

export default function DashboardLayout() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    let cancelled = false;
    function loadName() {
      apiClient
        .get('/auth/me')
        .then(({ data }) => {
          if (!cancelled && data?.name) setDisplayName(data.name);
        })
        .catch(() => {});
    }
    loadName();
    const onProfileUpdated = () => loadName();
    window.addEventListener('scriptify:profile-updated', onProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('scriptify:profile-updated', onProfileUpdated);
    };
  }, [location.pathname]);

  const initial = (displayName || user?.id || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-transparent">
      {/* Skip-nav for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground"
      >
        Skip to main content
      </a>

      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-surface-border bg-surface/80 px-4 py-4 shadow-glass backdrop-blur-xl sm:px-8">
        <Link
          to="/dashboard"
          className="text-h3 font-bold tracking-tight text-content transition hover:text-accent sm:text-2xl"
        >
          Scriptify
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/dashboard"
            className="rounded-xl border border-surface-border bg-surface-muted/80 px-4 py-2 text-small font-medium text-content-muted transition hover:border-accent/30 hover:text-content"
          >
            Dashboard
          </Link>
          <Link
            to="/dashboard/upload"
            className="rounded-xl bg-accent px-4 py-2 text-small font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 active:scale-[0.98] sm:px-6"
          >
            Upload
          </Link>
          <Link
            to="/dashboard/billing"
            className="rounded-xl border border-surface-border bg-surface-muted/80 px-4 py-2 text-small font-medium text-content-muted transition hover:border-accent/30 hover:text-content"
          >
            Billing
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-small font-medium text-rose-300 transition hover:border-rose-400/50 hover:bg-rose-500/15"
            >
              Admin
            </Link>
          )}
          <Link
            to="/dashboard/profile"
            title="Profile"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-cyan-600 text-small font-bold text-accent-foreground ring-2 ring-canvas transition hover:brightness-110"
          >
            <span aria-hidden>{initial}</span>
            <span className="sr-only">Profile</span>
          </Link>
        </nav>
      </header>

      <main id="main-content" className="relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-8 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
