import { Link } from 'react-router-dom';
import PricingSection from '../components/PricingSection';

export default function Pricing() {
  return (
    <div className="relative flex min-h-screen flex-col bg-transparent">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between border-b border-surface-border bg-surface/80 px-6 py-4 shadow-glass backdrop-blur-xl sm:px-8">
        <Link to="/" className="text-h3 font-bold tracking-tight text-content transition hover:text-accent">
          Scriptify
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="rounded-xl border border-surface-border bg-surface-muted/80 px-4 py-2 text-small font-medium text-content-muted transition hover:border-accent/30 hover:text-content"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-xl border border-accent/45 px-6 py-2 text-small font-semibold text-accent transition hover:bg-accent-muted"
          >
            Sign up free
          </Link>
        </div>
      </header>

      <main className="relative z-0 flex flex-1 flex-col items-center px-4 py-16 sm:py-24">
        <PricingSection />
      </main>
    </div>
  );
}
