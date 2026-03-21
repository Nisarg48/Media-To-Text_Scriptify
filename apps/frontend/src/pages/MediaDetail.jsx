import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [summary, setSummary] = useState(null);
  const [summaryGenLoading, setSummaryGenLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [summaryCopyFlash, setSummaryCopyFlash] = useState(false);
  const [summaryPdfLoading, setSummaryPdfLoading] = useState(false);

  const loadMedia = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await apiClient.get(`/media/${id}`);
      setMedia(data.media);
      setTranscript(data.transcript || null);
      setSummary(data.summary ?? null);
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

  useEffect(() => {
    if (summary?.userText != null) setNotesDraft(summary.userText);
    else setNotesDraft('');
  }, [summary?._id, summary?.userText]);

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

  const triggerBlobDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExport = async (format) => {
    if (!id) return;
    setError('');
    try {
      const res = await apiClient.get(`/transcripts/${id}/download`, {
        params: { format },
        responseType: 'blob',
      });
      triggerBlobDownload(res.data, `transcript_${id}.${format}`);
    } catch (err) {
      setError(err.response?.data?.msg || `Failed to download ${format.toUpperCase()}.`);
    }
  };

  const handleGenerateSummary = async () => {
    if (!id) return;
    setError('');
    setSummaryGenLoading(true);
    try {
      const { data } = await apiClient.post(`/summaries/${id}/generate`, {});
      setSummary(data.summary);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to generate summary.');
    } finally {
      setSummaryGenLoading(false);
    }
  };

  const handleCopySummary = async () => {
    if (!summary?.text) return;
    setError('');
    try {
      await navigator.clipboard.writeText(summary.text);
      setSummaryCopyFlash(true);
      setTimeout(() => setSummaryCopyFlash(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const summaryPdfLocalName = (mediaFilename) => {
    const name = String(mediaFilename || 'media');
    const stem = name.replace(/\.[^.]+$/, '') || 'media';
    const safe = stem.replace(/[^\w\s.-]+/g, '_').replace(/\s+/g, '_').slice(0, 100);
    return `summary_${safe}.pdf`;
  };

  const handleDownloadSummaryPdf = async () => {
    if (!id) return;
    setError('');
    setSummaryPdfLoading(true);
    try {
      const res = await apiClient.get(`/summaries/${id}/download/pdf`, { responseType: 'blob' });
      const ct = (res.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json')) {
        const text = await res.data.text();
        const j = JSON.parse(text);
        setError(j.msg || 'Failed to download summary PDF.');
        return;
      }
      triggerBlobDownload(res.data, summaryPdfLocalName(media?.filename));
    } catch (err) {
      let msg = 'Failed to download summary PDF.';
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          const t = await data.text();
          const j = JSON.parse(t);
          if (j.msg) msg = j.msg;
        } catch {
          /* ignore */
        }
      } else if (typeof err.response?.data?.msg === 'string') {
        msg = err.response.data.msg;
      }
      setError(msg);
    } finally {
      setSummaryPdfLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!id || !summary?._id) return;
    setNotesSaving(true);
    try {
      const { data } = await apiClient.put(`/summaries/${id}`, { userText: notesDraft });
      setSummary(data.summary);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to save notes.');
    } finally {
      setNotesSaving(false);
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Export</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { format: 'srt', label: 'SRT' },
                  { format: 'vtt', label: 'WebVTT' },
                  { format: 'txt', label: 'Plain text' },
                ].map(({ format, label }) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => handleDownloadExport(format)}
                    className="rounded-lg border border-emerald-500/80 bg-white px-2 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 active:scale-[0.98]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {canShowPlayer && transcript && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">AI summary</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Generated from your transcript as Markdown (headings, lists, bold). Copy keeps the same structure for pasting elsewhere.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {summary?.text && (
                <>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    {summaryCopyFlash ? 'Copied!' : 'Copy Markdown'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSummaryPdf}
                    disabled={summaryPdfLoading}
                    className="rounded-lg border border-emerald-500/80 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {summaryPdfLoading ? 'PDF…' : 'Download PDF'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={summaryGenLoading}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {summaryGenLoading ? 'Generating…' : summary?.text ? 'Regenerate' : 'Generate summary'}
              </button>
            </div>
          </div>
          {summary?.text ? (
            <div className="summary-md rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-800 [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:first:mt-0 [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-900 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p]:text-slate-700 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = match || String(children).includes('\n');
                    if (!isBlock && !className) {
                      return (
                        <code className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-xs text-slate-800" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900/90 p-3 font-mono text-xs text-slate-100">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                }}
              >
                {summary.text}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No summary yet. Generate one from your transcript (uses the configured AI provider).</p>
          )}
          {summary?._id && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label htmlFor="summary-notes" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your notes
              </label>
              <textarea
                id="summary-notes"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={handleSaveNotes}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-500/20 focus:border-emerald-400 focus:ring-2"
                placeholder="Private notes (saved automatically on blur)…"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                >
                  {notesSaving ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          )}
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
