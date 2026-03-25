import { Link } from 'react-router-dom';
import PricingSection from '../components/PricingSection';

export default function Pricing() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" aria-hidden />

      <header className="relative z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur">
        <Link to="/" className="text-xl font-bold tracking-tight text-slate-800 transition hover:text-emerald-600">
          Scriptify
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            Log in
          </Link>
          <Link to="/register" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600">
            Sign up free
          </Link>
        </div>
      </header>

      <main className="relative z-0 flex flex-1 flex-col items-center px-4 py-16">
        <PricingSection />
      </main>
    </div>
  );
}
