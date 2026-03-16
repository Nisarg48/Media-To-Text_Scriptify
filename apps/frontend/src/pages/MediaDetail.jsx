import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import ProcessingTimeline from '../components/ProcessingTimeline';
import SimpleVideoPlayer from '../components/SimpleVideoPlayer';

const STATUS_CONFIG = {
  UPLOADING: { label: 'Uploading', className: 'bg-slate-200 text-slate-700' },
  UPLOADED: { label: 'Queued', className: 'bg-slate-200 text-slate-700' },
  PROCESSING: { label: 'Processing', className: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Done', className: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

const POLL_INTERVAL_MS = 3000;

// Normalize segment time (Whisper may return seconds or milliseconds)
function toSec(v) {
  if (v == null || v === undefined) return 0;
  return Number(v) > 1000 ? Number(v) / 1000 : Number(v);
}

// Don't switch to next segment until we're this far into it (reduces "one step ahead" feel)
const SEGMENT_LEAD_IN = 0.12;

function getCurrentSegmentIndex(segments, currentTime) {
  if (!segments?.length || currentTime == null) return -1;
  const t = currentTime;
  for (let i = 0; i < segments.length; i++) {
    const start = toSec(segments[i].start);
    const end = toSec(segments[i].end);
    if (t >= start + SEGMENT_LEAD_IN && t < end) return i;
    if (t >= end) {
      const nextStart = i + 1 < segments.length ? toSec(segments[i + 1].start) + SEGMENT_LEAD_IN : Infinity;
      if (t < nextStart) return i;
    }
  }
  if (t >= toSec(segments[segments.length - 1].end)) return segments.length - 1;
  return 0;
}

export default function MediaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const segmentRefs = useRef([]);
  const lastSavedSegmentsRef = useRef(null);

  const [media, setMedia] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [content, setContent] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTechnicalError, setShowTechnicalError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      .then((res) => {
        const data = res.data;
        setContent(data);
        lastSavedSegmentsRef.current = data?.segments ? JSON.stringify(data.segments) : null;
      })
      .catch(() => setContent(null));
  }, [media, transcript, id]);

  // Only fetch playback URL when processing is COMPLETED (avoids video reload during processing)
  useEffect(() => {
    if (!media || media.status !== 'COMPLETED') return;
    apiClient
      .get(`/media/${id}/play`)
      .then((res) => setPlaybackUrl(res.data.playbackUrl || ''))
      .catch(() => setPlaybackUrl(''));
  }, [media, id]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  }, []);

  const segments = content?.segments ?? [];
  const currentSegmentIndex = getCurrentSegmentIndex(segments, currentTime);
  const currentSegment = segments[currentSegmentIndex];

  useEffect(() => {
    const container = transcriptScrollRef.current;
    const el = currentSegmentIndex >= 0 ? segmentRefs.current[currentSegmentIndex] : null;
    if (!container || !el) return;
    const containerHeight = container.clientHeight;
    const elTop = el.offsetTop;
    const elHalf = el.offsetHeight / 2;
    const scrollTop = elTop - containerHeight / 2 + elHalf;
    container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
  }, [currentSegmentIndex]);

  const handleSave = async () => {
    if (!content?.segments || !id) return;
    setSaveLoading(true);
    setSaveSuccess(false);
    setError('');
    try {
      const updatedSegments = content.segments;
      const updatedText = updatedSegments.map((s) => (s.text ?? '').trim()).join(' ');
      await apiClient.put(`/transcripts/${id}`, {
        updatedText,
        updatedSegments,
      });
      setContent((c) => (c ? { ...c, text: updatedText, segments: updatedSegments } : c));
      lastSavedSegmentsRef.current = JSON.stringify(updatedSegments);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to save.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSegmentChange = (index, newText) => {
    setContent((c) => {
      if (!c?.segments) return c;
      return {
        ...c,
        segments: c.segments.map((s, i) => (i === index ? { ...s, text: newText } : s)),
      };
    });
  };

  const hasTranscriptEdits = useMemo(() => {
    if (!content?.segments?.length) return false;
    const saved = lastSavedSegmentsRef.current;
    if (saved == null) return false;
    try {
      const current = JSON.stringify(content.segments);
      return current !== saved;
    } catch {
      return false;
    }
  }, [content?.segments]);

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

  const confirmDelete = async () => {
    if (!id) return;
    try {
      await apiClient.delete(`/media/${id}`);
      setShowDeleteModal(false);
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
  const canShowPlayer = media.status === 'COMPLETED' && playbackUrl;
  const showTimeline = ['UPLOADING', 'UPLOADED', 'PROCESSING'].includes(media.status);
  const errorMessageForUser = media.errorDetails?.userMessage
    || (media.errorDetails?.message ? getFriendlyErrorMessage(media.errorDetails.message) : null);

  return (
    <div className="mx-auto max-w-7xl animate-fade-in pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-sm font-medium text-slate-500 transition hover:text-emerald-600">← Dashboard</Link>
          <h1 className="mt-1 truncate text-xl font-bold text-slate-800 sm:text-2xl" title={media.filename}>
            {media.filename}
          </h1>
          <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {showTimeline && (
        <div className="mb-6">
          <ProcessingTimeline
            status={media.status}
            retryAttempt={media.errorDetails?.attempt}
          />
          {media.status === 'PROCESSING' && media.errorDetails?.attempt === 2 && (
            <p className="mt-2 text-sm text-amber-700">
              We're retrying (attempt 2). This may take a moment.
            </p>
          )}
        </div>
      )}

      {media.status === 'FAILED' && (errorMessageForUser || media.errorDetails?.message) && (
        <div className="mb-6 animate-fade-in rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-red-800">{errorMessageForUser}</p>
          {media.errorDetails?.message && (
            <>
              <button
                type="button"
                onClick={() => setShowTechnicalError((s) => !s)}
                className="mt-2 text-xs font-medium text-red-600 underline hover:text-red-700"
              >
                {showTechnicalError ? 'Hide technical details' : 'Show technical details'}
              </button>
              {showTechnicalError && (
                <pre className="mt-2 overflow-x-auto rounded bg-red-100/50 p-2 text-xs text-red-700">
                  {media.errorDetails.message}
                </pre>
              )}
            </>
          )}
        </div>
      )}

      {/* Processing: static placeholder only (no video = no reload) */}
      {!canShowPlayer && (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-sm">
          <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300">
            <div className="text-slate-500 transition transform duration-300 ease-out" style={{ fontSize: '3rem' }} aria-hidden>
              {isVideo ? '🎬' : '🎵'}
            </div>
            <p className="mt-3 text-sm font-medium text-slate-600">
              {media.status === 'COMPLETED'
                ? 'Loading playback…'
                : isVideo
                  ? 'Video will be available when processing is complete'
                  : 'Audio will be available when processing is complete'}
            </p>
            <p className="mt-1 text-xs text-slate-500">No preview while processing — avoids reload issues</p>
          </div>
        </div>
      )}

      {/* Completed: video left + captions; transcript timeline right (editable in place) */}
      {canShowPlayer && (
        <div className="mb-6 grid gap-6 lg:grid-cols-[1fr,400px]">
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-lg">
            {isVideo ? (
              <SimpleVideoPlayer
                src={playbackUrl}
                segments={segments}
                currentSegmentIndex={currentSegmentIndex}
                onTimeUpdate={(t) => setCurrentTime(t)}
                isVideo={true}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-900">
                <audio
                  ref={videoRef}
                  controls
                  className="w-full p-4"
                  src={playbackUrl}
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>
            )}
          </div>

          <div className="flex max-h-[28rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transcript</span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveLoading || !content?.segments?.length || !hasTranscriptEdits}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!hasTranscriptEdits ? 'No changes to save' : 'Save transcript edits'}
                aria-label={hasTranscriptEdits ? 'Save transcript' : 'Save (no changes)'}
              >
                {saveLoading ? 'Saving…' : saveSuccess ? 'Saved' : 'Save'}
              </button>
            </div>
            <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3">
              {!content ? (
                <p className="py-4 text-center text-slate-500">Loading transcript…</p>
              ) : segments.length === 0 ? (
                <p className="text-slate-500">No segments.</p>
              ) : (
                <ul className="space-y-2">
                  {segments.map((seg, i) => {
                    const isActive = i === currentSegmentIndex;
                    return (
                      <li
                        key={i}
                        ref={(el) => { segmentRefs.current[i] = el; }}
                        className={`rounded-lg border px-3 py-2.5 transition-all duration-200 ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-100 shadow-sm ring-2 ring-emerald-400/50'
                            : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="text"
                          value={seg.text ?? ''}
                          onChange={(e) => handleSegmentChange(i, e.target.value)}
                          className={`w-full border-0 bg-transparent text-sm outline-none focus:ring-0 ${
                            isActive ? 'font-semibold text-emerald-900' : 'text-slate-700'
                          } placeholder:text-slate-400`}
                          placeholder="—"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-slate-50/50 p-3">
              <button
                type="button"
                onClick={handleDownloadSrt}
                className="w-full rounded-lg border-2 border-emerald-500 bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:border-emerald-600 hover:shadow-lg active:scale-[0.98]"
              >
                Download SRT
              </button>
            </div>
          </div>
        </div>
      )}

      {error && media.status === 'COMPLETED' && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-all duration-200 hover:bg-red-100"
        >
          Delete media
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="delete-modal-title" className="text-lg font-semibold text-slate-800">
              Delete media?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This will delete the media and its transcript. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
