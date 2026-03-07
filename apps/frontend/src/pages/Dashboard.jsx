import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

const STATUS_CONFIG = {
  UPLOADING: { label: 'Uploading', className: 'bg-slate-200 text-slate-700' },
  UPLOADED: { label: 'Queued', className: 'bg-slate-200 text-slate-700' },
  PROCESSING: { label: 'Processing', className: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Done', className: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
}

export default function Dashboard() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/media')
      .then((res) => {
        if (!cancelled) setMedia(res.data.media || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load media.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        {error}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg sm:p-12">
          <h2 className="text-xl font-semibold text-slate-800 sm:text-2xl">No media yet</h2>
          <p className="mt-2 text-slate-600">Upload your first audio or video to get a transcript.</p>
          <Link
            to="/dashboard/upload"
            className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            Upload media
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-8 pt-1">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Your media</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {media.map((item, i) => {
          const statusInfo = STATUS_CONFIG[item.status] || { label: item.status, className: 'bg-slate-200 text-slate-700' };
          return (
            <li key={item._id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'backwards' }}>
              <Link
                to={`/media/${item._id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md hover:scale-[1.01]"
              >
                <p className="truncate font-medium text-slate-800" title={item.filename}>
                  {item.filename}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
