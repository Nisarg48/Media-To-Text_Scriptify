import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import languages from '@shared/languages.json';
import LanguageSelect from '../components/LanguageSelect';

const ACCEPTED_TYPES = ['audio/', 'video/'];

const getErrorMessage = (err) => {
  const data = err.response?.data;
  if (data?.errors?.length) return data.errors[0].msg;
  return data?.message || data?.msg || 'Upload failed.';
};

function getMediaType(file) {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('video/')) return 'VIDEO';
  if (type.startsWith('audio/')) return 'AUDIO';
  return 'VIDEO';
}

function getFormat(fileName) {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : 'bin';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function isAccepted(file) {
  return ACCEPTED_TYPES.some((t) => (file.type || '').toLowerCase().startsWith(t));
}

export default function Upload() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [targetLanguageCode, setTargetLanguageCode] = useState('en');
  const [sourceLanguageCode, setSourceLanguageCode] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const pickFile = useCallback((chosen) => {
    if (!chosen) return;
    if (!isAccepted(chosen)) {
      setError('Only audio and video files are supported.');
      return;
    }
    setFile(chosen);
    setError('');
  }, []);

  const handleFileChange = (e) => pickFile(e.target.files?.[0]);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!loading) setDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    pickFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file.');
      return;
    }
    setError('');
    setLoading(true);
    setUploadProgress(0);

    const fileName = file.name;
    const fileType = file.type || 'application/octet-stream';
    const mediaType = getMediaType(file);
    const format = getFormat(fileName);

    try {
      const { data: presigned } = await apiClient.post('/media/presigned-url', {
        fileName,
        fileType,
        sizeBytes: file.size,
      });
      const { uploadUrl, fileKey } = presigned;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', fileType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      const { data: final } = await apiClient.post('/media/finalize', {
        fileName,
        fileKey,
        mediaType,
        format,
        targetLanguageCode,
        sourceLanguageCode: sourceLanguageCode || undefined,
      });

      const mediaId = final?.media?._id;
      navigate(mediaId ? `/media/${mediaId}` : '/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const mediaTypeLabel = file
    ? getMediaType(file) === 'VIDEO' ? 'Video' : 'Audio'
    : null;

  return (
    <div className="mx-auto max-w-lg animate-fade-in pb-12 pt-2">
      <h1 className="mb-6 text-h2 font-bold text-content">Upload media</h1>
      <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl sm:p-8">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-xl border border-status-fail-border bg-status-fail-bg px-4 py-3 text-small text-status-fail-text animate-shake"
          >
            <span className="shrink-0" aria-hidden>⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Drag-and-drop zone */}
          <div>
            <input
              ref={fileInputRef}
              id="upload-file"
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              disabled={loading}
              className="sr-only"
              aria-label="Choose audio or video file"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-label={file ? `Selected file: ${file.name}. Click to change.` : 'Select or drop an audio or video file'}
              className={[
                'group relative w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                loading
                  ? 'cursor-not-allowed opacity-60'
                  : dragOver
                    ? 'border-accent bg-accent-muted scale-[1.01]'
                    : file
                      ? 'border-accent/50 bg-accent-muted/40 hover:border-accent hover:bg-accent-muted/60'
                      : 'border-surface-border bg-surface-muted/30 hover:border-accent/50 hover:bg-surface-muted/50',
              ].join(' ')}
            >
              {/* Upload icon */}
              <svg
                className={`mx-auto mb-3 h-8 w-8 transition-colors ${file ? 'text-accent' : 'text-content-subtle group-hover:text-accent/70'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden
              >
                {file ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                )}
              </svg>

              {file ? (
                <>
                  <p className="text-small font-semibold text-content">{file.name}</p>
                  <p className="mt-1 text-xs text-content-muted">
                    {mediaTypeLabel} · {formatBytes(file.size)}
                  </p>
                  <p className="mt-2 text-xs text-accent">Click to change file</p>
                </>
              ) : (
                <>
                  <p className="text-small font-medium text-content">
                    {dragOver ? 'Drop it here' : 'Drop file here, or click to browse'}
                  </p>
                  <p className="mt-1 text-xs text-content-subtle">
                    Audio or video — MP3, MP4, WAV, MOV, and more
                  </p>
                </>
              )}
            </button>
          </div>

          <LanguageSelect
            id="upload-target-lang"
            label="Target language"
            required
            value={targetLanguageCode}
            onChange={setTargetLanguageCode}
            disabled={loading}
            options={languages.map((l) => ({ value: l.code, label: l.name }))}
          />

          <LanguageSelect
            id="upload-source-lang"
            label="Source language (optional – leave empty for auto-detect)"
            value={sourceLanguageCode}
            onChange={setSourceLanguageCode}
            disabled={loading}
            options={[{ value: '', label: 'Auto-detect' }, ...languages.filter((l) => l.code !== 'original').map((l) => ({ value: l.code, label: l.name }))]}
          />

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-content-subtle">
                <span>{uploadProgress < 100 ? 'Uploading…' : 'Processing…'}</span>
                {uploadProgress < 100 && <span>{uploadProgress}%</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${uploadProgress < 100 ? 'bg-accent' : 'animate-progress-pulse bg-accent'}`}
                  style={{ width: uploadProgress < 100 ? `${uploadProgress}%` : '100%' }}
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !file}
              className="flex-1 rounded-xl bg-accent py-4 text-small font-semibold text-accent-foreground shadow-glow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas disabled:pointer-events-none disabled:opacity-60 active:scale-[0.99]"
            >
              {loading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
              className="rounded-xl border border-surface-border bg-surface-muted/80 px-6 py-4 text-small font-medium text-content-muted transition hover:border-accent/30 hover:text-content disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
