"use client";

import { AlertCircle, Play, Pause, Volume2, VolumeX, Maximize, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ShowcaseVideo } from "@/types/showcase";
import { captureVideoFrame, resolveVideoUrl } from "@/lib/video-utils";

type ArtworkDialogProps = {
  artwork: ShowcaseVideo | null;
  onClose: () => void;
  onVideoPlayingChange?: (playing: boolean) => void;
};

/**
 * Accessible caption dialog.
 * - Video is loaded only after the visitor requests playback.
 * - Aspect ratio (16:9 or 9:16) is detected from the video metadata and the
 *   player container adapts accordingly.
 * - No thumbnail is shown inside the player; thumbnails appear only in the
 *   list view outside the gallery.
 */
export function ArtworkDialog({ artwork, onClose, onVideoPlayingChange }: ArtworkDialogProps) {
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  /** "landscape" | "portrait" | null — resolved once metadata is available */
  const [orientation, setOrientation] = useState<"landscape" | "portrait" | null>(artwork?.orientation || null);
  const [thumbnail, setThumbnail] = useState<string | null>(artwork?.thumbnailUrl || null);
  const [imageError, setImageError] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
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
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [artwork, onClose]);

  // Reset state whenever the selected artwork changes
  useEffect(() => {
    setShouldLoadVideo(false);
    setVideoFailed(false);
    setOrientation(artwork?.orientation || null);
    setThumbnail(artwork?.thumbnailUrl || null);
    setImageError(false);
    setVideoUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsMuted(false);

    if (artwork) {
      resolveVideoUrl(artwork.videoUrl).then((resolved) => {
        setVideoUrl(resolved);
        if (!artwork.thumbnailUrl) {
          captureVideoFrame(resolved)
            .then((dataUrl) => setThumbnail(dataUrl))
            .catch(() => {});
        }
      });
    }
  }, [artwork?.id, artwork?.orientation]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!artwork) return null;

  const isPortrait = orientation === "portrait";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#031421]/76 p-4 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="artwork-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-sm bg-[#fbfaf7] text-[#071a2c] shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#d4dce0] px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#5e8a79]">HANHOLL VIDEO EXHIBITION</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" id="artwork-dialog-title">
              {artwork.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            aria-label="작품 상세 닫기"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d4dce0] text-[#31516a] transition hover:bg-[#edf1ef]"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-col">
          {/* Video section */}
          <section className="bg-[#071a2c] p-4 sm:p-6">
            <div ref={containerRef} className="mx-auto relative aspect-video w-full overflow-hidden rounded-sm bg-[radial-gradient(circle_at_top,#1f5373,#071a2c_70%)] group">
              {shouldLoadVideo && !videoFailed ? (
                <>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                    autoPlay
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      setDuration(v.duration);
                      if (!artwork?.orientation) {
                        setOrientation(v.videoHeight > v.videoWidth ? "portrait" : "landscape");
                      }
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                    onError={() => setVideoFailed(true)}
                    onClick={togglePlay}
                  >
                    <source src={videoUrl ? `${videoUrl}?v=${new Date().getTime()}` : undefined} />
                  </video>

                  {/* Custom controls visible only when hovering the bottom 24 area */}
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/95 via-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 gap-2 z-10 pointer-events-auto">
                    {/* Progress Slider */}
                    <div className="w-full flex items-center">
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                        style={{
                          background: `linear-gradient(to right, #fbfaf7 0%, #fbfaf7 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) 100%)`
                        }}
                      />
                    </div>
                    {/* Controls Row */}
                    <div className="flex items-center justify-between text-white text-xs">
                      <div className="flex items-center gap-4">
                        <button type="button" onClick={togglePlay} className="hover:scale-105 transition">
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                        </button>
                        <span className="font-mono">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button type="button" onClick={toggleMute} className="hover:scale-105 transition">
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={toggleFullscreen} className="hover:scale-105 transition">
                          <Maximize className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : videoFailed ? (
                <div className="max-w-sm px-5 text-center text-white">
                  <AlertCircle aria-hidden="true" className="mx-auto h-10 w-10 text-[#d8cbe5]" />
                  <p className="mt-4 text-lg font-bold">영상 준비 중입니다</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">행사 전 실제 영상 파일을 등록하면 이 위치에서 재생됩니다.</p>
                </div>
              ) : (
                /* Play button — show thumbnail cover background if available */
                <div className="absolute inset-0 w-full h-full grid place-items-center">
                  {thumbnail && !imageError && (
                    <>
                      <img 
                        src={thumbnail} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover" 
                        onError={() => {
                          setImageError(true);
                          if (videoUrl) {
                            captureVideoFrame(videoUrl)
                              .then((dataUrl) => {
                                setThumbnail(dataUrl);
                                setImageError(false);
                              })
                              .catch(() => {});
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
                    </>
                  )}
                  <button
                    className="relative z-10 grid place-items-center gap-4 text-white transition hover:scale-105"
                    type="button"
                    onClick={() => setShouldLoadVideo(true)}
                  >
                    <span className="grid h-20 w-20 place-items-center rounded-full border border-white/55 bg-white/12 backdrop-blur-sm">
                      <Play aria-hidden="true" className="ml-1 h-8 w-8" />
                    </span>
                    <span className="text-sm font-semibold tracking-wide">작품 영상 재생</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Info section */}
          <section className="p-6 sm:p-7">
            <p className="text-sm font-bold text-[#5e8a79]">{artwork.teamLabel} · {artwork.studentNames.join(" · ")}</p>
            <p className="mt-4 text-sm leading-7 text-[#53636f]">{artwork.caption}</p>
          </section>
        </div>
      </article>
    </div>
  );
}
