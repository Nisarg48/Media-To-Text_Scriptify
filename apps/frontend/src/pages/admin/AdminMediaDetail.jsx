import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

const STATUS_CONFIG = {
    UPLOADING:  { label: 'Uploading',   cls: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
    UPLOADED:   { label: 'Queued',      cls: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
    PROCESSING: { label: 'Processing',  cls: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-400' },
    COMPLETED:  { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-400' },
    FAILED:     { label: 'Failed',      cls: 'bg-red-100 text-red-600',        dot: 'bg-red-400' },
};

const ROLE_CONFIG = {
    admin:  'bg-rose-100 text-rose-700',
    worker: 'bg-blue-100 text-blue-700',
    user:   'bg-slate-100 text-slate-600',
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
            <span className="w-36 shrink-0 text-sm text-slate-400">{label}</span>
            <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-700">{children}</span>
        </div>
    );
}

function Card({ title, children, className = '' }) {
    return (
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
            {title && <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>}
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
                <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
                <div className="grid gap-4 lg:grid-cols-2">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                            {[...Array(5)].map((_, j) => (
                                <div key={j} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${60 + j * 8}%` }} />
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
                <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            </div>
        );
    }

    if (!media) return null;

    const sc = STATUS_CONFIG[media.status] || { label: media.status, cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
    const ownerRole = media.mediaUploadedBy?.role || 'user';
    const isDeleted = !!media.deletedAt;

    return (
        <div className="animate-fade-in space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Link to="/admin/media" className="transition-colors hover:text-slate-700">Media</Link>
                <span>/</span>
                <span className="max-w-[200px] truncate font-medium text-slate-700" title={media.filename}>
                    {media.filename}
                </span>
            </div>

            {/* Title row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="max-w-[400px] truncate text-2xl font-bold text-slate-800" title={media.filename}>
                        {media.filename}
                    </h1>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${sc.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} ${media.status === 'PROCESSING' ? 'animate-pulse' : ''}`} />
                        {sc.label}
                    </span>
                    {isDeleted && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-600">
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
                            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow-md"
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
                <div className="animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    Media restored successfully
                </div>
            )}

            {retrySuccess && (
                <div className="animate-fade-in rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    Job requeued — media is queued for processing again.
                </div>
            )}

            {/* Content grid */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Media info */}
                <Card title="Media info">
                    <div className="divide-y divide-slate-100">
                        <InfoRow label="Filename">{media.filename}</InfoRow>
                        <InfoRow label="Type">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${media.mediaType === 'VIDEO' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
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
                                <span className="text-red-600">{formatDate(media.deletedAt)}</span>
                            </InfoRow>
                        )}
                    </div>
                </Card>

                {/* Owner */}
                <Card title="Owner">
                    <div className="divide-y divide-slate-100">
                        <InfoRow label="Name">{media.mediaUploadedBy?.name || '—'}</InfoRow>
                        <InfoRow label="Email">{media.mediaUploadedBy?.email || '—'}</InfoRow>
                        <InfoRow label="Role">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${ROLE_CONFIG[ownerRole] || 'bg-slate-100 text-slate-600'}`}>
                                {ownerRole}
                            </span>
                        </InfoRow>
                    </div>
                </Card>

                {/* Language & processing */}
                <Card title="Processing">
                    <div className="divide-y divide-slate-100">
                        <InfoRow label="Target lang">{media.targetLanguageCode || '—'}</InfoRow>
                        <InfoRow label="Language mode">{media.sourceLanguageMode || '—'}</InfoRow>
                        <InfoRow label="Source lang">{media.sourceLanguageCode || 'auto-detect'}</InfoRow>
                        <InfoRow label="Detected lang">{media.detectedLanguage || '—'}</InfoRow>
                        {media.status === 'FAILED' && media.errorDetails && (
                            <>
                                <InfoRow label="Error stage">
                                    <span className="text-red-600">{media.errorDetails.stage || '—'}</span>
                                </InfoRow>
                                <InfoRow label="Error message">
                                    <span className="text-red-600 text-xs leading-relaxed">{media.errorDetails.message || '—'}</span>
                                </InfoRow>
                                {media.errorDetails.userMessage && (
                                    <InfoRow label="User message">
                                        <span className="text-amber-700 text-xs">{media.errorDetails.userMessage}</span>
                                    </InfoRow>
                                )}
                                <InfoRow label="Attempts">{media.errorDetails.attempt ?? '—'}</InfoRow>
                            </>
                        )}
                    </div>
                </Card>

                {/* Transcript */}
                <Card title="Transcript">
                    {!transcript ? (
                        <p className="text-sm italic text-slate-400">
                            {media.status === 'COMPLETED' ? 'Transcript metadata unavailable (file may be deleted)' : 'No transcript yet'}
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-100">
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
                                    <span className="line-clamp-4 text-xs leading-relaxed text-slate-500">
                                        {transcript.plainText.slice(0, 300)}
                                        {transcript.plainText.length > 300 ? '…' : ''}
                                    </span>
                                </InfoRow>
                            )}
                        </div>
                    )}
                </Card>
            </div>

            {/* Raw IDs */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">
                    <span className="font-medium text-slate-500">Media ID:</span>{' '}
                    <span className="font-mono">{media._id}</span>
                    {transcript && (
                        <>
                            <span className="mx-3 text-slate-300">|</span>
                            <span className="font-medium text-slate-500">Transcript ID:</span>{' '}
                            <span className="font-mono">{transcript._id}</span>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
