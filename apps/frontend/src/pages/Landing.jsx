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
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.015)_1px,transparent_1px)] bg-[size:48px_48px]" aria-hidden />

      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <span className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Scriptify</span>
        <div className="flex items-center gap-3">
          <Link
            to="/pricing"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-white hover:text-emerald-600 hover:shadow-md sm:px-4"
          >
            Pricing
          </Link>
          <Link
            to="/login?next=%2Fdashboard%2Fupload"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-white hover:text-emerald-600 hover:shadow-md sm:px-4"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] sm:px-4"
          >
            Sign up
          </Link>
        </div>
      </header>

      <main className="relative flex flex-col items-center px-4 py-12 sm:py-16">
        <div className="max-w-xl text-center">
          <h1 className="animate-fade-in opacity-0 [animation-fill-mode:forwards] text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl lg:text-5xl [animation-delay:100ms]">
            Turn media into text
          </h1>
          <p className="mt-4 animate-fade-in opacity-0 text-lg text-slate-600 [animation-fill-mode:forwards] sm:text-xl [animation-delay:200ms]">
            Upload audio or video and get transcripts you can edit and download.
          </p>
          <Link
            to="/login?next=%2Fdashboard%2Fupload"
            className="animate-fade-in-up mt-8 inline-flex opacity-0 items-center rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-emerald-600 hover:shadow-xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.98] [animation-fill-mode:forwards] [animation-delay:300ms]"
          >
            Upload media
          </Link>
          <p className="mt-4 animate-fade-in opacity-0 text-sm text-slate-500 [animation-fill-mode:forwards] [animation-delay:400ms]">
            Sign in or create an account to upload and manage your media.
          </p>
        </div>

        <div className="mt-20 w-full max-w-5xl border-t border-slate-200/80 pt-16">
          <PricingSection />
        </div>
      </main>
    </div>
  );
}
