import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

const STATUS_CONFIG = {
    UPLOADING:  { label: 'Uploading',   cls: 'border border-slate-500/40 bg-slate-700/50 text-slate-200',    dot: 'bg-slate-400' },
    UPLOADED:   { label: 'Queued',      cls: 'border border-slate-500/40 bg-slate-700/50 text-slate-200',    dot: 'bg-slate-400' },
    PROCESSING: { label: 'Processing',  cls: 'border border-amber-500/35 bg-amber-500/15 text-amber-200',    dot: 'bg-amber-400' },
    COMPLETED:  { label: 'Completed',   cls: 'border border-accent/40 bg-accent-muted text-accent', dot: 'bg-accent' },
    FAILED:     { label: 'Failed',      cls: 'border border-red-500/35 bg-red-500/15 text-red-300',        dot: 'bg-red-400' },
};

const ROLE_CONFIG = {
    admin:  'border border-rose-500/35 bg-rose-500/15 text-rose-200',
    worker: 'border border-sky-500/35 bg-sky-500/15 text-sky-200',
    user:   'border border-slate-500/40 bg-slate-700/50 text-slate-200',
};

function formatBytes(bytes) {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatMs(ms) {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function InfoRow({ label, children }) {
    return (
        <div className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
            <span className="w-36 shrink-0 text-small text-content-subtle">{label}</span>
            <span className="min-w-0 flex-1 break-words text-small font-medium text-content">{children}</span>
        </div>
    );
}

function Card({ title, children, className = '' }) {
    return (
        <div className={`rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl ${className}`}>
            {title && <h2 className="mb-4 text-base font-semibold text-content">{title}</h2>}
            {children}
        </div>
    );
}

export default function AdminMediaDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [media, setMedia] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [restoring, setRestoring] = useState(false);
    const [restoreSuccess, setRestoreSuccess] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [retrySuccess, setRetrySuccess] = useState(false);

    useEffect(() => {
        apiClient
            .get(`/admin/media/${id}`)
            .then((res) => {
                setMedia(res.data.media);
                setTranscript(res.data.transcript);
            })
            .catch((err) => setError(err.response?.data?.msg || 'Failed to load media'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleRestore = async () => {
        setRestoring(true);
        try {
            const res = await apiClient.post(`/admin/media/${id}/restore`);
            setMedia(res.data.media);
            setRestoreSuccess(true);
            setTimeout(() => setRestoreSuccess(false), 3000);
        } catch (err) {
            setError(err.response?.data?.msg || 'Restore failed');
        } finally {
            setRestoring(false);
        }
    };

    const handleRetryJob = async () => {
        setRetrying(true);
        setError('');
        try {
            const res = await apiClient.post(`/admin/media/${id}/retry-job`);
            setMedia(res.data.media);
            setRetrySuccess(true);
            setTimeout(() => setRetrySuccess(false), 4000);
        } catch (err) {
            setError(err.response?.data?.msg || 'Requeue failed');
        } finally {
            setRetrying(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-fade-in space-y-4">
                <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-muted/60" />
                <div className="grid gap-4 lg:grid-cols-2">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="space-y-3 rounded-2xl border border-surface-border bg-surface/90 p-6">
                            {[...Array(5)].map((_, j) => (
                                <div key={j} className="h-4 animate-pulse rounded bg-surface-muted/60" style={{ width: `${60 + j * 8}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="animate-fade-in space-y-4">
                <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-small text-content-subtle transition-colors hover:text-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-small text-red-200">{error}</div>
            </div>
        );
    }

    if (!media) return null;

    const sc = STATUS_CONFIG[media.status] || { label: media.status, cls: 'border border-slate-500/40 bg-slate-700/50 text-slate-200', dot: 'bg-slate-400' };
    const ownerRole = media.mediaUploadedBy?.role || 'user';
    const isDeleted = !!media.deletedAt;

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex items-center gap-2 text-small text-content-subtle">
                <Link to="/admin/media" className="transition-colors hover:text-accent">Media</Link>
                <span>/</span>
                <span className="max-w-[200px] truncate font-medium text-content" title={media.filename}>
                    {media.filename}
                </span>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="max-w-[400px] truncate text-h2 font-bold text-content" title={media.filename}>
                        {media.filename}
                    </h1>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${sc.cls}`}>
                        <span className={`h-2 w-2 rounded-full ${sc.dot} ${media.status === 'PROCESSING' ? 'animate-pulse' : ''}`} />
                        {sc.label}
                    </span>
                    {isDeleted && (
                        <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300">
                            Deleted
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {!isDeleted && (media.status === 'FAILED' || media.status === 'UPLOADED') && (
                        <button
                            type="button"
                            onClick={handleRetryJob}
                            disabled={retrying}
                            className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-small font-semibold text-amber-200 shadow-sm transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Requeue processing (FAILED or stuck UPLOADED)"
                        >
                            {retrying ? 'Requeuing…' : 'Requeue job'}
                        </button>
                    )}
                    {isDeleted && (
                        <button
                            type="button"
                            onClick={handleRestore}
                            disabled={restoring}
                            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-small font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {restoring ? (
                                <>
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                        <path d="M12 2a10 10 0 0110 10" />
                                    </svg>
                                    Restoring…
                                </>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                        <polyline points="1 4 1 10 7 10" />
                                        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                                    </svg>
                                    Restore
                                </>
                            )}
                        </button>
                    )}
                    {!isDeleted && media.status === 'COMPLETED' && (
                        <Link
                            to={`/media/${media._id}`}
                            className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-muted/80 px-4 py-2 text-small font-medium text-content shadow-sm transition hover:border-accent/40"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                            </svg>
                            View in App
                        </Link>
                    )}
                </div>
            </div>

            {restoreSuccess && (
                <div className="animate-fade-in rounded-xl border border-accent/40 bg-accent-muted px-4 py-3 text-small font-medium text-accent">
                    Media restored successfully
                </div>
            )}

            {retrySuccess && (
                <div className="animate-fade-in rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-small font-medium text-amber-200">
                    Job requeued — media is queued for processing again.
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Media info">
                    <div className="divide-y divide-surface-border">
                        <InfoRow label="Filename">{media.filename}</InfoRow>
                        <InfoRow label="Type">
                            <span className={`rounded-md px-2 py-1 text-xs font-medium ${media.mediaType === 'VIDEO' ? 'border border-sky-500/35 bg-sky-500/15 text-sky-200' : 'border border-violet-500/35 bg-violet-500/15 text-violet-200'}`}>
                                {media.mediaType}
                            </span>
                        </InfoRow>
                        <InfoRow label="Format">{media.format || '—'}</InfoRow>
                        <InfoRow label="Size">{formatBytes(media.sizeBytes)}</InfoRow>
                        <InfoRow label="Duration">
                            {media.lengthMs ? `${(media.lengthMs / 1000).toFixed(1)}s` : '—'}
                        </InfoRow>
                        <InfoRow label="Uploaded">{formatDate(media.createdAt)}</InfoRow>
                        {isDeleted && (
                            <InfoRow label="Deleted at">
                                <span className="text-red-300">{formatDate(media.deletedAt)}</span>
                            </InfoRow>
                        )}
                    </div>
                </Card>

                <Card title="Owner">
                    <div className="divide-y divide-surface-border">
                        <InfoRow label="Name">{media.mediaUploadedBy?.name || '—'}</InfoRow>
                        <InfoRow label="Email">{media.mediaUploadedBy?.email || '—'}</InfoRow>
                        <InfoRow label="Role">
                            <span className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${ROLE_CONFIG[ownerRole] || 'border border-slate-500/40 bg-slate-700/50 text-slate-200'}`}>
                                {ownerRole}
                            </span>
                        </InfoRow>
                    </div>
                </Card>

                <Card title="Processing">
                    <div className="divide-y divide-surface-border">
                        <InfoRow label="Target lang">{media.targetLanguageCode || '—'}</InfoRow>
                        <InfoRow label="Language mode">{media.sourceLanguageMode || '—'}</InfoRow>
                        <InfoRow label="Source lang">{media.sourceLanguageCode || 'auto-detect'}</InfoRow>
                        <InfoRow label="Detected lang">{media.detectedLanguage || '—'}</InfoRow>
                        {media.status === 'FAILED' && media.errorDetails && (
                            <>
                                <InfoRow label="Error stage">
                                    <span className="text-red-300">{media.errorDetails.stage || '—'}</span>
                                </InfoRow>
                                <InfoRow label="Error message">
                                    <span className="text-xs leading-relaxed text-red-300">{media.errorDetails.message || '—'}</span>
                                </InfoRow>
                                {media.errorDetails.userMessage && (
                                    <InfoRow label="User message">
                                        <span className="text-xs text-amber-200">{media.errorDetails.userMessage}</span>
                                    </InfoRow>
                                )}
                                <InfoRow label="Attempts">{media.errorDetails.attempt ?? '—'}</InfoRow>
                            </>
                        )}
                    </div>
                </Card>

                <Card title="Transcript">
                    {!transcript ? (
                        <p className="text-small italic text-content-subtle">
                            {media.status === 'COMPLETED' ? 'Transcript metadata unavailable (file may be deleted)' : 'No transcript yet'}
                        </p>
                    ) : (
                        <div className="divide-y divide-surface-border">
                            <InfoRow label="Language">{transcript.language || '—'}</InfoRow>
                            <InfoRow label="Confidence">
                                {transcript.confidence != null ? `${(transcript.confidence * 100).toFixed(1)}%` : '—'}
                            </InfoRow>
                            <InfoRow label="Detection conf.">
                                {transcript.languageDetectionConfidence != null
                                    ? `${(transcript.languageDetectionConfidence * 100).toFixed(1)}%`
                                    : '—'}
                            </InfoRow>
                            <InfoRow label="Model size">{transcript.modelSize || '—'}</InfoRow>
                            <InfoRow label="Total time">{formatMs(transcript.totalTranscriptionTime)}</InfoRow>
                            <InfoRow label="Model time">{formatMs(transcript.modelProcessingTime)}</InfoRow>
                            {transcript.plainText && (
                                <InfoRow label="Preview">
                                    <span className="line-clamp-4 text-xs leading-relaxed text-content-muted">
                                        {transcript.plainText.slice(0, 300)}
                                        {transcript.plainText.length > 300 ? '…' : ''}
                                    </span>
                                </InfoRow>
                            )}
                        </div>
                    )}
                </Card>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-muted/30 px-4 py-4">
                <p className="text-xs text-content-subtle">
                    <span className="font-medium text-content-muted">Media ID:</span>{' '}
                    <span className="font-mono">{media._id}</span>
                    {transcript && (
                        <>
                            <span className="mx-3 text-surface-border">|</span>
                            <span className="font-medium text-content-muted">Transcript ID:</span>{' '}
                            <span className="font-mono">{transcript._id}</span>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
