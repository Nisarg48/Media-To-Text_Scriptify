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

      <main className="relative flex flex-col items-center px-4 pb-24 pt-16 sm:pt-28">

        {/* Hero */}
        <div className="max-w-2xl text-center">
          <p className="animate-fade-in mb-4 inline-block rounded-full border border-accent/30 bg-accent-muted px-4 py-1 text-xs font-semibold uppercase tracking-widest text-accent opacity-0 [animation-delay:50ms] [animation-fill-mode:forwards]">
            AI Transcription
          </p>
          <h1 className="animate-fade-in text-display opacity-0 [animation-fill-mode:forwards] text-content [animation-delay:100ms] sm:text-[3rem] lg:text-[3.75rem]">
            Turn media<br className="hidden sm:block" /> into text
          </h1>
          <p className="mt-5 animate-fade-in opacity-0 text-lg leading-relaxed text-content-muted [animation-fill-mode:forwards] sm:text-xl [animation-delay:200ms]">
            Upload any audio or video file. Get an accurate, editable transcript in minutes — powered by AI.
          </p>
          <div className="animate-fade-in-up mt-10 flex flex-col items-center gap-4 opacity-0 [animation-fill-mode:forwards] [animation-delay:300ms] sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-8 py-4 text-body font-semibold text-accent-foreground shadow-glow transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas active:scale-[0.98] sm:w-auto"
            >
              Get started free
            </Link>
            <Link
              to="/login?next=%2Fdashboard%2Fupload"
              className="inline-flex w-full items-center justify-center rounded-xl border border-surface-border bg-surface-muted/60 px-8 py-4 text-body font-medium text-content-muted transition hover:border-accent/30 hover:text-content sm:w-auto"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-5 animate-fade-in opacity-0 text-small text-content-subtle [animation-fill-mode:forwards] [animation-delay:400ms]">
            Free plan available · No credit card required
          </p>
        </div>

        {/* Feature highlights */}
        <div className="animate-fade-in mt-20 grid w-full max-w-3xl grid-cols-1 gap-px opacity-0 overflow-hidden rounded-2xl border border-surface-border [animation-delay:500ms] [animation-fill-mode:forwards] sm:grid-cols-3">
          {[
            { icon: '🎙', title: 'Audio & video', body: 'MP3, MP4, WAV, MOV, and more. If it has sound, we can transcribe it.' },
            { icon: '🌐', title: 'Multi-language', body: 'Auto-detect or choose from dozens of source and target languages.' },
            { icon: '✏️', title: 'Edit & export', body: 'Review your transcript, make corrections, and download in your preferred format.' },
          ].map(({ icon, title, body }) => (
            <div key={title} className="bg-surface/60 px-6 py-6 backdrop-blur-sm">
              <span className="text-2xl" aria-hidden>{icon}</span>
              <p className="mt-3 text-small font-semibold text-content">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-content-subtle">{body}</p>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="mt-24 w-full max-w-5xl border-t border-surface-border pt-20">
          <PricingSection />
        </div>
      </main>
    </div>
  );
}
