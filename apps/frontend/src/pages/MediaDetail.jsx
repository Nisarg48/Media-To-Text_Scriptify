import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../api/client';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import ProcessingTimeline from '../components/ProcessingTimeline';
import SimpleVideoPlayer from '../components/SimpleVideoPlayer';
const STATUS_CONFIG = {
  UPLOADING: { label: 'Uploading', className: 'border border-status-neutral-border bg-status-neutral-bg text-status-neutral-text' },
  UPLOADED:  { label: 'Queued',    className: 'border border-status-neutral-border bg-status-neutral-bg text-status-neutral-text' },
  PROCESSING:{ label: 'Processing',className: 'border border-status-warn-border bg-status-warn-bg text-status-warn-text' },
  COMPLETED: { label: 'Done',   className: 'border border-accent/40 bg-accent-muted text-accent' },
  FAILED:    { label: 'Failed', className: 'border border-status-fail-border bg-status-fail-bg text-status-fail-text' },
};

const POLL_INTERVAL_MS = 3000;

// Normalize segment time (Whisper may return seconds or milliseconds)
function toSec(v) {
  if (v == null || v === undefined) return 0;
  return Number(v) > 1000 ? Number(v) / 1000 : Number(v);
}

// Don't switch to next segment until we're this far into it (reduces "one step ahead" feel)
const SEGMENT_LEAD_IN = 0.12;

/** Scroll only the transcript panel — never use scrollIntoView on segment nodes (it scrolls the whole page). */
function scrollElementToTopOfContainer(container, el, behavior = 'smooth') {
  if (!container || !el) return;
  const padding = 8;
  const nextTop =
    el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - padding;
  container.scrollTo({ top: Math.max(0, nextTop), behavior });
}

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
  /** Video (SimpleVideoPlayer) or audio element — pause when editing/scrolling transcript */
  const playbackMediaRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const segmentRefs = useRef([]);
  const lastSavedSegmentsRef = useRef(null);
  /** True while auto-scroll is running so we do not treat it as user scroll */
  const programmaticTranscriptScrollRef = useRef(false);
  const programmaticScrollClearTimerRef = useRef(null);

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
    const v = playbackMediaRef.current;
    if (v) setCurrentTime(v.currentTime);
  }, []);

  const pausePlayback = useCallback(() => {
    const el = playbackMediaRef.current;
    if (el && !el.paused) el.pause();
  }, []);

  /** When true, active line is pinned to the top of the transcript panel during playback */
  const [followTranscriptScroll, setFollowTranscriptScroll] = useState(true);

  const segments = content?.segments ?? [];
  const currentSegmentIndex = getCurrentSegmentIndex(segments, currentTime);

  useEffect(() => {
    if (!followTranscriptScroll) return undefined;
    const raf = requestAnimationFrame(() => {
      const container = transcriptScrollRef.current;
      const el = currentSegmentIndex >= 0 ? segmentRefs.current[currentSegmentIndex] : null;
      if (!container || !el) return;
      programmaticTranscriptScrollRef.current = true;
      if (programmaticScrollClearTimerRef.current) {
        window.clearTimeout(programmaticScrollClearTimerRef.current);
      }
      scrollElementToTopOfContainer(container, el, 'smooth');
      programmaticScrollClearTimerRef.current = window.setTimeout(() => {
        programmaticTranscriptScrollRef.current = false;
      }, 900);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (programmaticScrollClearTimerRef.current) {
        window.clearTimeout(programmaticScrollClearTimerRef.current);
      }
    };
  }, [currentSegmentIndex, followTranscriptScroll, segments.length]);

  const handleTranscriptPanelScroll = useCallback(() => {
    if (programmaticTranscriptScrollRef.current) return;
    pausePlayback();
    setFollowTranscriptScroll(false);
  }, [pausePlayback]);

  useEffect(() => {
    const ready = media?.status === 'COMPLETED' && !!playbackUrl;
    if (!ready) return undefined;
    let cleaned = false;
    let attachedEl = null;
    const onPlay = () => setFollowTranscriptScroll(true);
    const timer = window.setTimeout(() => {
      if (cleaned) return;
      const el = playbackMediaRef.current;
      if (!el) return;
      attachedEl = el;
      el.addEventListener('play', onPlay);
    }, 0);
    return () => {
      cleaned = true;
      window.clearTimeout(timer);
      if (attachedEl) attachedEl.removeEventListener('play', onPlay);
    };
  }, [media?.status, playbackUrl]);

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
    setFollowTranscriptScroll(false);
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
        <p className="text-content-muted">Loading…</p>
      </div>
    );
  }

  if (error && !media) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
        {error}
        <Link to="/dashboard" className="ml-2 font-medium text-accent underline hover:brightness-125">Back to dashboard</Link>
      </div>
    );
  }

  if (!media) return null;

  const statusInfo = STATUS_CONFIG[media.status] || { label: media.status, className: 'border border-status-neutral-border bg-status-neutral-bg text-status-neutral-text' };
  const isVideo = media.mediaType === 'VIDEO';
  const canShowPlayer = media.status === 'COMPLETED' && playbackUrl;
  const showTimeline = ['UPLOADING', 'UPLOADED', 'PROCESSING'].includes(media.status);
  const errorMessageForUser = media.errorDetails?.userMessage
    || (media.errorDetails?.message ? getFriendlyErrorMessage(media.errorDetails.message) : null);

  return (
    <div className="mx-auto max-w-7xl animate-fade-in space-y-10 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link to="/dashboard" className="text-small font-medium text-content-subtle transition hover:text-accent">← Dashboard</Link>
          <h1 className="mt-2 break-words text-h3 font-bold text-content sm:text-h2">{media.filename}</h1>
          <span className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-medium ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {showTimeline && (
        <div>
          <ProcessingTimeline
            status={media.status}
            retryAttempt={media.errorDetails?.attempt}
          />
          {media.status === 'PROCESSING' && media.errorDetails?.attempt === 2 && (
            <p className="mt-2 text-small text-amber-200">
              We&apos;re retrying (attempt 2). This may take a moment.
            </p>
          )}
        </div>
      )}

      {media.status === 'FAILED' && (errorMessageForUser || media.errorDetails?.message) && (
        <div className="animate-fade-in rounded-xl border border-red-500/40 bg-red-500/10 p-4 shadow-glass">
          <p className="text-small font-medium text-red-200">{errorMessageForUser}</p>
          {media.errorDetails?.message && (
            <>
              <button
                type="button"
                onClick={() => setShowTechnicalError((s) => !s)}
                className="mt-2 text-xs font-medium text-red-300 underline hover:text-red-200"
              >
                {showTechnicalError ? 'Hide technical details' : 'Show technical details'}
              </button>
              {showTechnicalError && (
                <pre className="mt-2 overflow-x-auto rounded bg-canvas/80 p-2 text-xs text-red-200">
                  {media.errorDetails.message}
                </pre>
              )}
            </>
          )}
        </div>
      )}

      {/* Processing: static placeholder only (no video = no reload) */}
      {!canShowPlayer && (
        <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-muted/40 p-2 shadow-glass">
          <div className="flex aspect-video w-full max-h-64 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-canvas-elevated to-slate-800/80">
            <div className="text-content-muted transition transform duration-300 ease-out" style={{ fontSize: '3rem' }} aria-hidden>
              {isVideo ? '🎬' : '🎵'}
            </div>
            <p className="mt-4 text-small font-medium text-content-muted">
              {media.status === 'COMPLETED'
                ? 'Loading playback…'
                : isVideo
                  ? 'Video will be available when processing is complete'
                  : 'Audio will be available when processing is complete'}
            </p>
            <p className="mt-2 text-xs text-content-subtle">No preview while processing — avoids reload issues</p>
          </div>
        </div>
      )}

      {/* Completed: video left + captions; transcript timeline right (editable in place) */}
      {canShowPlayer && (
        <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
          <div className="overflow-hidden rounded-xl border border-surface-border shadow-glass">
            {isVideo ? (
              <SimpleVideoPlayer
                src={playbackUrl}
                segments={segments}
                currentSegmentIndex={currentSegmentIndex}
                onTimeUpdate={(t) => setCurrentTime(t)}
                isVideo={true}
                playbackRef={playbackMediaRef}
              />
            ) : (
              <div className="rounded-xl border border-surface-border bg-canvas">
                <audio
                  ref={playbackMediaRef}
                  controls
                  className="w-full p-4"
                  src={playbackUrl}
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setFollowTranscriptScroll(true)}
                />
              </div>
            )}
          </div>

          <div className="flex max-h-[28rem] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface/90 shadow-glass backdrop-blur-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-surface-border bg-surface-muted/50 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-subtle">Transcript</span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveLoading || !content?.segments?.length || !hasTranscriptEdits}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                title={!hasTranscriptEdits ? 'No changes to save' : 'Save transcript edits'}
                aria-label={hasTranscriptEdits ? 'Save transcript' : 'Save (no changes)'}
              >
                {saveLoading ? 'Saving…' : saveSuccess ? 'Saved' : 'Save'}
              </button>
            </div>
            <div
              ref={transcriptScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4"
              onScroll={handleTranscriptPanelScroll}
            >
              {!content ? (
                <p className="py-4 text-center text-content-muted">Loading transcript…</p>
              ) : segments.length === 0 ? (
                <p className="text-content-muted">No segments.</p>
              ) : (
                <ul className="space-y-2">
                  {segments.map((seg, i) => {
                    const isActive = i === currentSegmentIndex;
                    return (
                      <li
                        key={i}
                        ref={(el) => { segmentRefs.current[i] = el; }}
                        className={`scroll-mt-2 rounded-lg border px-3 py-3 transition-all duration-200 ${
                          isActive
                            ? 'border-accent bg-accent-muted shadow-glow-sm ring-2 ring-accent/30'
                            : 'border-surface-border bg-surface-muted/40 hover:border-surface-border hover:bg-surface-muted/60'
                        }`}
                      >
                        <input
                          type="text"
                          value={seg.text ?? ''}
                          onChange={(e) => handleSegmentChange(i, e.target.value)}
                          onFocus={() => {
                            pausePlayback();
                            setFollowTranscriptScroll(false);
                          }}
                          className={`w-full border-0 bg-transparent text-small outline-none focus:ring-0 ${
                            isActive ? 'font-semibold text-accent' : 'text-content'
                          } placeholder:text-content-subtle`}
                          placeholder="—"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="shrink-0 border-t border-surface-border bg-surface-muted/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">Export</p>
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
                    className="rounded-lg border border-accent/50 bg-surface-muted/60 px-2 py-2 text-xs font-semibold text-accent shadow-sm transition hover:bg-accent-muted active:scale-[0.98]"
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
        <div className="rounded-xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-small font-semibold text-content">AI summary</h2>
              <p className="mt-2 text-xs text-content-subtle">
                Generated from your transcript as Markdown (headings, lists, bold). Copy keeps the same structure for pasting elsewhere.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {summary?.text && (
                <>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="rounded-lg border border-surface-border bg-surface-muted/60 px-3 py-2 text-xs font-semibold text-content shadow-sm transition hover:border-accent/40"
                  >
                    {summaryCopyFlash ? 'Copied!' : 'Copy Markdown'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSummaryPdf}
                    disabled={summaryPdfLoading}
                    className="rounded-lg border border-accent/50 bg-accent-muted px-3 py-2 text-xs font-semibold text-accent shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  >
                    {summaryPdfLoading ? 'PDF…' : 'Download PDF'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={summaryGenLoading}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 disabled:opacity-50"
              >
                {summaryGenLoading ? 'Generating…' : summary?.text ? 'Regenerate' : 'Generate summary'}
              </button>
            </div>
          </div>
          {summary?.text ? (
            <div className="summary-md rounded-lg border border-surface-border bg-surface-muted/30 p-4 text-small leading-relaxed text-content [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-content [&_h1]:first:mt-0 [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-content [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-small [&_h3]:font-semibold [&_h3]:text-content [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p]:text-content-muted [&_strong]:font-semibold [&_strong]:text-content [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-surface-border [&_blockquote]:pl-3 [&_blockquote]:italic">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = match || String(children).includes('\n');
                    if (!isBlock && !className) {
                      return (
                        <code className="rounded bg-surface-muted px-1 py-1 font-mono text-xs text-accent" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="my-2 overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-xs text-content">
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
            <p className="text-small text-content-muted">No summary yet. Generate one from your transcript (uses the configured AI provider).</p>
          )}
          {summary?._id && (
            <div className="mt-6 border-t border-surface-border pt-6">
              <label htmlFor="summary-notes" className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                Your notes
              </label>
              <textarea
                id="summary-notes"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={handleSaveNotes}
                rows={3}
                className="mt-2 w-full rounded-lg border border-surface-border bg-surface-muted/50 px-3 py-2 text-small text-content outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                placeholder="Private notes (saved automatically on blur)…"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                >
                  {notesSaving ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && media.status === 'COMPLETED' && (
        <p className="text-small text-red-300">{error}</p>
      )}

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 text-small font-medium text-red-200 transition hover:bg-red-500/15"
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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-surface-border bg-surface/95 p-6 shadow-glass backdrop-blur-xl">
            <h2 id="delete-modal-title" className="text-lg font-semibold text-content">
              Delete media?
            </h2>
            <p className="mt-2 text-small text-content-muted">
              This will delete the media and its transcript. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-surface-border bg-surface-muted/80 px-6 py-3 text-small font-medium text-content-muted hover:border-accent/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-6 py-3 text-small font-medium text-white hover:bg-red-500"
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
