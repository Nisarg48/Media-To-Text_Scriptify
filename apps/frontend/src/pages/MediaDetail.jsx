import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import ProcessingTimeline from '../components/ProcessingTimeline';

const STATUS_CONFIG = {
  UPLOADING: { label: 'Uploading', className: 'bg-slate-200 text-slate-700' },
  UPLOADED: { label: 'Queued', className: 'bg-slate-200 text-slate-700' },
  PROCESSING: { label: 'Processing', className: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Done', className: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

const POLL_INTERVAL_MS = 3000;

export default function MediaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [media, setMedia] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [content, setContent] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTechnicalError, setShowTechnicalError] = useState(false);

  const loadMedia = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await apiClient.get(`/media/${id}`);
      setMedia(data.media);
      setTranscript(data.transcript || null);
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to load media.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Poll when still processing (so timeline and status stay up to date)
  const isProcessing = media && ['UPLOADING', 'UPLOADED', 'PROCESSING'].includes(media.status);
  useEffect(() => {
    if (!id || !isProcessing) return;
    const t = setInterval(loadMedia, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [id, isProcessing, loadMedia]);

  useEffect(() => {
    if (!media || !transcript) return;
    apiClient
      .get(`/transcripts/${id}/content`)
      .then((res) => setContent(res.data))
      .catch(() => setContent(null));
  }, [media, transcript, id]);

  useEffect(() => {
    if (!media) return;
    apiClient
      .get(`/media/${id}/play`)
      .then((res) => setPlaybackUrl(res.data.playbackUrl || ''))
      .catch(() => setPlaybackUrl(''));
  }, [media, id]);

  const handleSave = async () => {
    if (!content || !id) return;
    setSaveLoading(true);
    setSaveSuccess(false);
    setError('');
    try {
      await apiClient.put(`/transcripts/${id}`, {
        updatedText: content.text,
        updatedSegments: content.segments,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to save.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDownloadSrt = async () => {
    if (!id) return;
    setError('');
    try {
      const res = await apiClient.get(`/transcripts/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript_${id}.srt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to download SRT.');
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this media and its transcript? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/media/${id}`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error && !media) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        {error}
        <Link to="/dashboard" className="ml-2 font-medium text-emerald-600 underline hover:text-emerald-700">Back to dashboard</Link>
      </div>
    );
  }

  if (!media) return null;

  const statusInfo = STATUS_CONFIG[media.status] || { label: media.status, className: 'bg-slate-200 text-slate-700' };
  const isVideo = media.mediaType === 'VIDEO';
  const canEditTranscript = media.status === 'COMPLETED' && transcript;
  const showTimeline = ['UPLOADING', 'UPLOADED', 'PROCESSING'].includes(media.status);
  const friendlyError = media.errorDetails?.message ? getFriendlyErrorMessage(media.errorDetails.message) : null;

  return (
    <div className="mx-auto max-w-4xl animate-fade-in pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-sm font-medium text-slate-500 transition hover:text-emerald-600">← Dashboard</Link>
          <h1 className="mt-1 truncate text-xl font-bold text-slate-800 sm:text-2xl" title={media.filename}>
            {media.filename}
          </h1>
          <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Timeline: only when still processing (not when user returns later to a completed/failed item) */}
      {showTimeline && (
        <div className="mb-6">
          <ProcessingTimeline status={media.status} />
        </div>
      )}

      {/* User-friendly error when failed */}
      {media.status === 'FAILED' && (friendlyError || media.errorDetails?.message) && (
        <div className="mb-6 animate-fade-in rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-red-800">{friendlyError}</p>
          {media.errorDetails?.message && (
            <button
              type="button"
              onClick={() => setShowTechnicalError((s) => !s)}
              className="mt-2 text-xs font-medium text-red-600 underline hover:text-red-700"
            >
              {showTechnicalError ? 'Hide technical details' : 'Show technical details'}
            </button>
          )}
          {showTechnicalError && media.errorDetails?.message && (
            <pre className="mt-2 overflow-x-auto rounded bg-red-100/50 p-2 text-xs text-red-700">
              {media.errorDetails.message}
            </pre>
          )}
        </div>
      )}

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-sm">
        {playbackUrl ? (
          isVideo ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                controls
                className="h-full w-full object-contain"
                src={playbackUrl}
                preload="metadata"
                playsInline
              />
            </div>
          ) : (
            <audio controls className="w-full" src={playbackUrl} preload="metadata" />
          )
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-slate-200 text-slate-500">
            No playback available
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Transcript</h2>
        {media.status === 'PROCESSING' || media.status === 'UPLOADED' ? (
          <p className="text-slate-600">Transcript is being generated. This page updates automatically.</p>
        ) : media.status === 'FAILED' ? (
          <p className="text-slate-600">Transcription could not be completed. You can delete this item or try uploading again.</p>
        ) : !canEditTranscript ? (
          <p className="text-slate-600">No transcript yet.</p>
        ) : content ? (
          <>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <textarea
              value={content.text ?? ''}
              onChange={(e) => setContent((c) => ({ ...c, text: e.target.value }))}
              rows={12}
              className="mb-4 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-800 placeholder-slate-400 transition duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
              placeholder="Transcript text…"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveLoading}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.02] disabled:opacity-60 active:scale-[0.98]"
              >
                {saveLoading ? 'Saving…' : saveSuccess ? 'Saved' : 'Save transcript'}
              </button>
              <button
                type="button"
                onClick={handleDownloadSrt}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50"
              >
                Download SRT
              </button>
            </div>
          </>
        ) : (
          <p className="text-slate-600">Loading transcript…</p>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-all duration-200 hover:bg-red-100"
        >
          Delete media
        </button>
      </div>
    </div>
  );
}
