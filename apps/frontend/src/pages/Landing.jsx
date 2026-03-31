import { useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PricingSection from '../components/PricingSection';

export default function Landing() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate('/dashboard/upload', { replace: true });
    }
  }, [token, navigate]);

  if (token) return null;

  return (
    <div className="relative min-h-screen w-full bg-transparent">
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden
      />

      <header className="relative flex items-center justify-between px-4 py-6 sm:px-8 lg:px-10">
        <span className="text-h3 font-bold tracking-tight text-content sm:text-2xl">Scriptify</span>
        <div className="flex items-center gap-4">
          <Link
            to="/pricing"
            className="rounded-xl border border-transparent px-4 py-2 text-small font-medium text-content-muted transition hover:border-surface-border hover:bg-surface-muted/60 hover:text-content"
          >
            Pricing
          </Link>
          <Link
            to="/login?next=%2Fdashboard%2Fupload"
            className="rounded-xl border border-transparent px-4 py-2 text-small font-medium text-content-muted transition hover:border-surface-border hover:bg-surface-muted/60 hover:text-content"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-xl border border-accent/45 px-4 py-2 text-small font-semibold text-accent transition hover:bg-accent-muted active:scale-[0.98]"
          >
            Sign up
          </Link>
        </div>
      </header>

      <main className="relative flex flex-col items-center px-4 py-16 sm:py-24">
        <div className="max-w-xl text-center">
          <h1 className="animate-fade-in text-display opacity-0 [animation-fill-mode:forwards] text-content [animation-delay:100ms] sm:text-[3rem] lg:text-[3.5rem]">
            Turn media into text
          </h1>
          <p className="mt-6 animate-fade-in opacity-0 text-lg text-content-muted [animation-fill-mode:forwards] sm:text-xl [animation-delay:200ms]">
            Upload audio or video and get transcripts you can edit and download.
          </p>
          <Link
            to="/login?next=%2Fdashboard%2Fupload"
            className="animate-fade-in-up mt-10 inline-flex items-center rounded-xl bg-accent px-8 py-4 text-body font-semibold text-accent-foreground opacity-0 shadow-glow transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas active:scale-[0.98] [animation-fill-mode:forwards] [animation-delay:300ms]"
          >
            Upload media
          </Link>
          <p className="mt-6 animate-fade-in opacity-0 text-small text-content-subtle [animation-fill-mode:forwards] [animation-delay:400ms]">
            Sign in or create an account to upload and manage your media.
          </p>
        </div>

        <div className="mt-24 w-full max-w-5xl border-t border-surface-border pt-16">
          <PricingSection />
        </div>
      </main>
    </div>
  );
}
