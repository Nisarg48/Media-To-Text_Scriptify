import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

const STATUS_CONFIG = {
  UPLOADING: { label: 'Uploading', className: 'bg-slate-200 text-slate-700' },
  UPLOADED: { label: 'Queued', className: 'bg-slate-200 text-slate-700' },
  PROCESSING: { label: 'Processing', className: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Done', className: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

const MEDIA_TYPE_LABELS = {
  VIDEO: { label: 'Video', className: 'bg-blue-100 text-blue-800' },
  AUDIO: { label: 'Audio', className: 'bg-violet-100 text-violet-800' },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio' },
];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
}

export default function Dashboard() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

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

  const filteredMedia = useMemo(() => {
    if (typeFilter === 'all') return media;
    return media.filter((m) => m.mediaType === typeFilter);
  }, [media, typeFilter]);

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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Your media</h1>
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm" role="group" aria-label="Filter by type">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                typeFilter === opt.value
                  ? 'bg-white text-emerald-700 shadow-md'
                  : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filteredMedia.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">
            No {typeFilter === 'VIDEO' ? 'video' : 'audio'} yet.
            {typeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className="ml-1 font-medium text-emerald-600 hover:underline"
              >
                Show all
              </button>
            )}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMedia.map((item, i) => {
            const statusInfo = STATUS_CONFIG[item.status] || { label: item.status, className: 'bg-slate-200 text-slate-700' };
            const typeInfo = MEDIA_TYPE_LABELS[item.mediaType] || { label: item.mediaType, className: 'bg-slate-200 text-slate-700' };
            return (
              <li key={item._id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'backwards' }}>
                <Link
                  to={`/media/${item._id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-slate-800" title={item.filename}>
                      {item.filename}
                    </p>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${typeInfo.className}`}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                  <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
