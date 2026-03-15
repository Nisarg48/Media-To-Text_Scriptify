import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Simple custom video player: play/pause, progress bar, skip ±10s, fullscreen.
 * Subtitle is rendered above the control bar (and in fullscreen) so it never hides the time bar.
 * Segment start/end are in seconds (video.currentTime).
 */
export default function SimpleVideoPlayer({ src, segments = [], currentSegmentIndex, onTimeUpdate, isVideo = true }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentSegment = segments[currentSegmentIndex];

  const updateTime = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  }, [onTimeUpdate]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.addEventListener('timeupdate', updateTime);
    v.addEventListener('loadedmetadata', () => setDuration(v.duration));
    v.addEventListener('durationchange', () => setDuration(v.duration));
    v.addEventListener('play', () => setPlaying(true));
    v.addEventListener('pause', () => setPlaying(false));
    return () => {
      v.removeEventListener('timeupdate', updateTime);
      v.removeEventListener('loadedmetadata', () => {});
      v.removeEventListener('durationchange', () => {});
      v.removeEventListener('play', () => {});
      v.removeEventListener('pause', () => {});
    };
  }, [updateTime]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const skip = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e) => {
    const v = videoRef.current;
    if (!v || v.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    v.currentTime = x * v.duration;
  };

  const formatTime = (sec) => {
    if (sec == null || Number.isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex w-full flex-col overflow-hidden bg-black ${isFullscreen ? 'h-full min-h-0 rounded-none' : 'rounded-xl'}`}
    >
      {/* Video area + subtitle above controls (same layout in fullscreen) */}
      <div className={`relative w-full flex-1 bg-black ${isFullscreen ? 'flex min-h-0 flex-col justify-center' : 'aspect-video'}`}>
        {isVideo ? (
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            src={src}
            preload="metadata"
            playsInline
            onClick={togglePlay}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-slate-800">
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              src={src}
              preload="metadata"
              onClick={togglePlay}
            />
          </div>
        )}

        {/* Subtitle: above the control bar (and in fullscreen) so it never hides the time bar */}
        <div
          className={`absolute left-0 right-0 px-4 py-2 text-center ${isFullscreen ? 'bottom-16 text-lg' : 'bottom-14 text-sm'}`}
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {currentSegment?.text?.trim() && (
            <span className="font-medium text-white">
              {currentSegment.text.trim()}
            </span>
          )}
        </div>
      </div>

      {/* Custom control bar: progress + play/pause + skip + time + fullscreen */}
      <div className="flex shrink-0 flex-col gap-1 border-t border-slate-700 bg-slate-900/95 px-3 py-2">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          step={0.1}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-600 accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
          onChange={(e) => {
            const v = videoRef.current;
            if (v) v.currentTime = Number(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => skip(-10)}
              className="rounded p-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              title="Rewind 10s"
              aria-label="Rewind 10 seconds"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg>
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="rounded p-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              title={playing ? 'Pause' : 'Play'}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 01-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => skip(10)}
              className="rounded p-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              title="Forward 10s"
              aria-label="Forward 10 seconds"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" /></svg>
            </button>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          {isVideo && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded p-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v4a1 1 0 01-2 0V3H3a1 1 0 011-1h1zm13 0h1a1 1 0 011 1v1h-4a1 1 0 010-2h3V3a1 1 0 011-1zM2 16v-3a1 1 0 012 0v4h4a1 1 0 010 2H3a1 1 0 01-1-1zm16 0a1 1 0 01-1 1h-4a1 1 0 010-2h4v-4a1 1 0 012 0v5a1 1 0 01-1 1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 5.414V7a1 1 0 01-2 0V3zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 111.414-1.414L14 5.414V4zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L5.414 14H7a1 1 0 010 2H3a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L14 14.586V13a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
