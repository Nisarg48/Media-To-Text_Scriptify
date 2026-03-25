import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function DashboardLayout() {
  const { logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" aria-hidden />

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <Link
          to="/dashboard"
          className="text-xl font-bold tracking-tight text-slate-800 transition hover:text-emerald-600 sm:text-2xl"
        >
          Scriptify
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/dashboard"
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900"
          >
            Dashboard
          </Link>
          <Link
            to="/dashboard/upload"
            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] sm:px-4"
          >
            Upload
          </Link>
          <Link
            to="/dashboard/billing"
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900"
          >
            Billing
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-all duration-200 hover:bg-rose-100 hover:text-rose-800"
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/', { replace: true });
            }}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900"
          >
            Log out
          </button>
        </nav>
      </header>

      <main className="relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
