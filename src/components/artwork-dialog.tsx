"use client";

import { AlertCircle, Maximize, Pause, Play, Users, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { captureVideoFrame, resolveVideoUrl } from "@/lib/video-utils";
import type { ShowcaseVideo } from "@/types/showcase";

type ArtworkDialogProps = {
  artwork: ShowcaseVideo | null;
  onClose: () => void;
  onVideoPlayingChange?: (playing: boolean) => void;
};

type Orientation = "landscape" | "portrait";

const ACCENT_COLORS: Record<ShowcaseVideo["accent"], string> = {
  pine: "#4d9079",
  hydrangea: "#9484c4",
  navy: "#3f88b8",
};

function formatTime(time: number) {
  if (Number.isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Cinematic caption dialog.
 * - Video is loaded only after the visitor requests playback.
 * - The player box follows the real media aspect (poster first, then video
 *   metadata), so phone videos stand tall instead of being letterboxed.
 */
export function ArtworkDialog({ artwork, onClose, onVideoPlayingChange }: ArtworkDialogProps) {
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>(artwork?.orientation ?? "landscape");
  const [thumbnail, setThumbnail] = useState<string | null>(artwork?.thumbnailUrl || null);
  const [imageError, setImageError] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [cacheBuster] = useState(() => Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onVideoPlayingChange?.(isPlaying);
    return () => {
      onVideoPlayingChange?.(false);
    };
  }, [isPlaying, onVideoPlayingChange]);

  useEffect(() => {
    if (!artwork) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((error: unknown) => console.warn("전체 화면을 닫지 못했습니다.", error));
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [artwork, onClose]);

  useEffect(() => {
    if (!artwork) return;
    let isActive = true;
    resolveVideoUrl(artwork.videoUrl).then((resolved) => {
      if (!isActive) return;
      setVideoUrl(resolved);
      if (!artwork.thumbnailUrl) {
        captureVideoFrame(resolved)
          .then((dataUrl) => isActive && setThumbnail(dataUrl))
          .catch((error: unknown) => console.warn(`${artwork.id}: 대표 프레임을 추출하지 못했습니다.`, error));
      }
    });
    return () => {
      isActive = false;
    };
  }, [artwork]);

  if (!artwork) return null;

  const accent = ACCENT_COLORS[artwork.accent];
  const isPortrait = orientation === "portrait";

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      return;
    }
    video.play().catch((error: unknown) => console.warn("영상을 재생하지 못했습니다.", error));
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = Number.parseFloat(event.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    const request = document.fullscreenElement ? document.exitFullscreen() : container.requestFullscreen();
    request.catch((error: unknown) => console.warn("전체 화면 전환에 실패했습니다.", error));
  };

  const recoverThumbnailFromVideo = () => {
    setImageError(true);
    if (!videoUrl) return;
    captureVideoFrame(videoUrl)
      .then((dataUrl) => {
        setThumbnail(dataUrl);
        setImageError(false);
      })
      .catch((error: unknown) => console.warn(`${artwork.id}: 대표 프레임을 추출하지 못했습니다.`, error));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      aria-labelledby="artwork-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#05080c]/82 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="relative max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1218] text-[#f4efe6] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent 70%)` }} />

        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-6 sm:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-[#0b1119]" style={{ background: accent }}>
                {artwork.teamLabel}
              </span>
              <span className="text-[11px] font-bold tracking-[0.2em] text-white/45">HANHOLL VIDEO EXHIBITION</span>
            </div>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl" id="artwork-dialog-title">
              {artwork.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            aria-label="작품 상세 닫기"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <section className="px-3 sm:px-7">
          <div
            ref={containerRef}
            className={`group relative mx-auto overflow-hidden rounded-xl bg-black ${isPortrait ? "aspect-[9/16] h-[min(62dvh,640px)] w-auto max-w-full" : "aspect-video w-full"}`}
          >
            {shouldLoadVideo && !videoFailed ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  className="absolute inset-0 h-full w-full bg-black object-contain"
                  playsInline
                  preload="metadata"
                  onClick={togglePlay}
                  onDurationChange={(event) => setDuration(event.currentTarget.duration)}
                  onError={() => setVideoFailed(true)}
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    setDuration(video.duration);
                    setOrientation(video.videoHeight > video.videoWidth ? "portrait" : "landscape");
                  }}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                >
                  <source src={videoUrl ? `${videoUrl}?v=${cacheBuster}` : undefined} />
                </video>

                <div className={`video-controls absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity duration-300 ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
                  <input
                    aria-label="재생 위치"
                    className="video-range"
                    max={duration || 100}
                    min={0}
                    step={0.1}
                    style={{ background: `linear-gradient(to right, #fbfaf7 0%, #fbfaf7 ${progress}%, rgba(255,255,255,0.25) ${progress}%, rgba(255,255,255,0.25) 100%)` }}
                    type="range"
                    value={currentTime}
                    onChange={handleSeek}
                  />
                  <div className="flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-3">
                      <button aria-label={isPlaying ? "일시정지" : "재생"} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 transition hover:bg-white/30" type="button" onClick={togglePlay}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4 fill-white" />}
                      </button>
                      <span className="font-mono tabular-nums text-white/85">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button aria-label={isMuted ? "소리 켜기" : "소리 끄기"} className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/20" type="button" onClick={toggleMute}>
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                      <button aria-label="전체 화면" className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/20" type="button" onClick={toggleFullscreen}>
                        <Maximize className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : videoFailed ? (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,#1f3344,#0d1218_70%)] px-5 text-center">
                <div className="max-w-sm">
                  <AlertCircle aria-hidden="true" className="mx-auto h-10 w-10 text-[#d8cbe5]" />
                  <p className="mt-4 text-lg font-bold">영상 준비 중입니다</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">행사 전 실제 영상 파일을 등록하면 이 위치에서 재생됩니다.</p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                {thumbnail && !imageError && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local poster chosen at runtime */}
                    <img
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      src={thumbnail}
                      onError={recoverThumbnailFromVideo}
                      onLoad={(event) => {
                        const image = event.currentTarget;
                        setOrientation(image.naturalHeight > image.naturalWidth ? "portrait" : "landscape");
                      }}
                    />
                    <div className="absolute inset-0 bg-black/45" />
                  </>
                )}
                <button className="relative z-10 grid place-items-center gap-4 text-white transition hover:scale-105" type="button" onClick={() => setShouldLoadVideo(true)}>
                  <span className="grid h-20 w-20 place-items-center rounded-full border border-white/40 bg-white/10 shadow-[0_0_60px_rgba(255,255,255,0.18)] backdrop-blur-sm">
                    <Play aria-hidden="true" className="ml-1 h-8 w-8 fill-white" />
                  </span>
                  <span className="text-sm font-semibold tracking-wide">작품 영상 재생</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="px-5 py-6 sm:px-7 sm:py-7">
          <p className="text-[15px] leading-7 text-white/80">{artwork.caption}</p>
          <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-sm text-white/60">
            <Users aria-hidden="true" className="h-4 w-4" style={{ color: accent }} />
            <span className="font-semibold text-white/85">{artwork.teamLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{artwork.studentNames.join(" · ")}</span>
          </div>
        </section>
      </article>
    </div>
  );
}
