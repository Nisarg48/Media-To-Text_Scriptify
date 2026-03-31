import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import languages from '@shared/languages.json';
import LanguageSelect from '../components/LanguageSelect';

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

export default function Upload() {
  const [file, setFile] = useState(null);
  const [targetLanguageCode, setTargetLanguageCode] = useState('en');
  const [sourceLanguageCode, setSourceLanguageCode] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0];
    setFile(chosen || null);
    setError('');
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

  return (
    <div className="mx-auto max-w-lg animate-fade-in pb-12 pt-2">
      <h1 className="mb-6 text-h2 font-bold text-content">Upload media</h1>
      <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl sm:p-8">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-small text-red-200 animate-shake"
          >
            <span className="shrink-0 text-red-400" aria-hidden>⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="upload-file" className="mb-2 block text-small font-medium text-content-muted">
              File (audio or video)
            </label>
            <input
              id="upload-file"
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              disabled={loading}
              className="w-full rounded-xl border border-surface-border bg-surface-muted/50 px-4 py-3 text-content file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-small file:font-medium file:text-accent-foreground file:transition hover:file:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
            />
            {file && (
              <p className="mt-2 text-xs text-content-subtle">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
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

          {loading && uploadProgress < 100 && (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-surface-muted">
                <div
                  className="h-2 rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-content-subtle">Uploading… {uploadProgress}%</p>
            </div>
          )}

          <div className="flex gap-4">
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
