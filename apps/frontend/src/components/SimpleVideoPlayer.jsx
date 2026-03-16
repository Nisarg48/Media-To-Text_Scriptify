import { useRef, useState, useCallback, useEffect } from 'react';

const FONT_SIZES = [12, 16, 20, 24, 28];
const DEFAULT_FONT_INDEX = 1;
const DEFAULT_SUBTITLE_POSITION = { x: 50, y: 88 };
const REFERENCE_WIDTH = 640;

/**
 * VLC-style video player: play/pause, ±10s, progress bar with fill + thumb,
 * fullscreen, subtitle font size, draggable subtitle, keyboard shortcuts.
 */
export default function SimpleVideoPlayer({ src, segments = [], currentSegmentIndex, onTimeUpdate, isVideo = true }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const subtitleRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitleFontIndex, setSubtitleFontIndex] = useState(DEFAULT_FONT_INDEX);
  const [subtitlePosition, setSubtitlePosition] = useState(DEFAULT_SUBTITLE_POSITION);
  const [draggingSubtitle, setDraggingSubtitle] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, pos: { x: 0, y: 0 } });
  const [containerWidth, setContainerWidth] = useState(REFERENCE_WIDTH);

  const currentSegment = segments[currentSegmentIndex];
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

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
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? {};
      if (typeof width === 'number') setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleFullscreenPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, []);

  const handleProgressClick = useCallback((e) => {
    const bar = progressBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || v.duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    v.currentTime = x * v.duration;
  }, []);

  const formatTime = (sec) => {
    if (sec == null || Number.isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.closest('input') || e.target.closest('textarea')) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(5);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            e.preventDefault();
            document.exitFullscreen().catch(() => {});
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, toggleFullscreen]);

  const handleSubtitleMouseDown = useCallback((e) => {
    e.preventDefault();
    setDraggingSubtitle(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      pos: { ...subtitlePosition },
    });
  }, [subtitlePosition]);

  useEffect(() => {
    if (!draggingSubtitle) return;
    const move = (e) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const px = (dx / rect.width) * 100;
      const py = (dy / rect.height) * 100;
      setSubtitlePosition({
        x: Math.max(0, Math.min(100, dragStart.pos.x + px)),
        y: Math.max(0, Math.min(100, dragStart.pos.y + py)),
      });
    };
    const up = () => setDraggingSubtitle(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [draggingSubtitle, dragStart]);

  const scale = containerWidth / REFERENCE_WIDTH;
  const subtitleFontSizePx = Math.round(FONT_SIZES[subtitleFontIndex] * scale);

  const ControlButton = ({ onClick, title, shortcut, icon, className = '' }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-2 text-slate-300 transition-all duration-200 hover:bg-white/15 hover:text-white hover:scale-105 active:scale-95 ${className}`}
      title={`${title} (${shortcut})`}
    >
      {icon}
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex w-full flex-col overflow-hidden bg-black ${isFullscreen ? 'h-screen w-screen rounded-none' : 'rounded-xl shadow-2xl'}`}
    >
      {/* Video area */}
      <div
        className={`relative w-full flex-1 bg-black select-none ${isFullscreen ? 'flex min-h-0 flex-col justify-center' : 'aspect-video'}`}
        onClick={togglePlay}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            src={src}
            preload="metadata"
            playsInline
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            src={src}
            preload="metadata"
          />
        )}

        {/* Draggable subtitle - font size scales with container so fullscreen vs normal look proportional */}
        <div
          ref={subtitleRef}
          className={`absolute z-10 cursor-move rounded px-3 py-2 text-center font-medium text-white ${draggingSubtitle ? 'cursor-grabbing opacity-90' : ''}`}
          style={{
            left: `${subtitlePosition.x}%`,
            top: `${subtitlePosition.y}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: `${subtitleFontSizePx}px`,
            textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)',
          }}
          onMouseDown={handleSubtitleMouseDown}
          onClick={(e) => e.stopPropagation()}
        >
          {currentSegment?.text?.trim() && (
            <span>{currentSegment.text.trim()}</span>
          )}
        </div>
      </div>

      {/* VLC-style control bar - z-30 so fullscreen button stays clickable */}
      <div
        className="relative z-30 flex shrink-0 flex-col gap-2 border-t border-slate-600 bg-gradient-to-t from-slate-900 to-slate-800 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar: green fill + thumb */}
        <div
          ref={progressBarRef}
          className="group relative h-2 w-full cursor-pointer rounded-full bg-slate-600 transition hover:h-2.5"
          onClick={handleProgressClick}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow-md transition-all group-hover:h-4 group-hover:w-4"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <ControlButton
              onClick={() => skip(-10)}
              title="Rewind 10s"
              shortcut="←"
              icon={<svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg>}
            />
            <ControlButton
              onClick={togglePlay}
              title={playing ? 'Pause' : 'Play'}
              shortcut="Space"
              icon={
                playing ? (
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 01-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                )
              }
            />
            <ControlButton
              onClick={() => skip(10)}
              title="Forward 10s"
              shortcut="→"
              icon={<svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" /></svg>}
            />
          </div>

          <span className="text-sm text-slate-400 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex items-center gap-1">
            {/* Subtitle font size */}
            <div className="flex items-center rounded-lg bg-slate-700/50 px-1">
              <button
                type="button"
                onClick={() => setSubtitleFontIndex((i) => Math.max(0, i - 1))}
                className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                title="Decrease subtitle size"
                aria-label="Decrease subtitle size"
              >
                <span className="text-sm font-bold">A−</span>
              </button>
              <span className="mx-1 text-xs text-slate-500">|</span>
              <button
                type="button"
                onClick={() => setSubtitleFontIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
                className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                title="Increase subtitle size"
                aria-label="Increase subtitle size"
              >
                <span className="text-sm font-bold">A+</span>
              </button>
            </div>

            {isVideo && (
              <button
                type="button"
                onPointerDown={handleFullscreenPointerDown}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className="cursor-pointer select-none rounded-lg p-2 text-slate-300 transition-all duration-200 hover:bg-white/15 hover:text-white hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/50"
                title={isFullscreen ? 'Exit fullscreen (F or Esc)' : 'Fullscreen (F)'}
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
    </div>
  );
}
