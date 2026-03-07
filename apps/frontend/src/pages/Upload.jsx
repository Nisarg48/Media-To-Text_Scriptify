import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import languages from '@shared/languages.json';
import LanguageSelect from '../components/LanguageSelect';

const getErrorMessage = (err) => {
  const data = err.response?.data;
  if (data?.errors?.length) return data.errors[0].msg;
  return data?.message || 'Upload failed.';
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
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Upload media</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-shake"
          >
            <span className="shrink-0 text-red-500" aria-hidden>⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="upload-file" className="mb-1 block text-sm font-medium text-slate-700">
              File (audio or video)
            </label>
            <input
              id="upload-file"
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-800 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:transition hover:file:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            />
            {file && (
              <p className="mt-1 text-xs text-slate-500">
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
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">Uploading… {uploadProgress}%</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !file}
              className="flex-1 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none active:scale-[0.99]"
            >
              {loading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
