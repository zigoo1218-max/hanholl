"use client";

import { ArrowLeft, Play, Users, Home } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ShowcaseVideo } from "@/types/showcase";
import { captureVideoFrame } from "@/lib/video-utils";

type ArtworkListViewProps = {
  artworks: ShowcaseVideo[];
  onBack: () => void;
  onSelect: (artwork: ShowcaseVideo) => void;
  canReturnTo3d: boolean;
  onReturnToEntrance?: () => void;
};

const accentClassNames = {
  pine: "from-[#2d5a49] to-[#173b35]",
  hydrangea: "from-[#766497] to-[#3f355b]",
  navy: "from-[#22577a] to-[#123553]",
};

/**
 * Shows thumbnailUrl first.
 * If it's missing or fails to load, captures the first frame of the video.
 * If that also fails, renders nothing so the parent gradient shows through.
 */
function ThumbnailImage({
  thumbnailUrl,
  videoUrl,
  alt,
}: {
  thumbnailUrl: string;
  videoUrl: string;
  alt: string;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(thumbnailUrl || null);
  const [errored, setErrored] = useState(false);
  const didCapture = useRef(false);

  // If no thumbnailUrl, try to capture video frame on mount
  useEffect(() => {
    if (thumbnailUrl || didCapture.current) return;
    didCapture.current = true;
    captureVideoFrame(videoUrl)
      .then((dataUrl) => setImgSrc(dataUrl))
      .catch(() => setErrored(true));
  }, [thumbnailUrl, videoUrl]);

  if (!imgSrc || errored) return null;

  return (
    <img
      src={imgSrc}
      alt={alt}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      onError={() => {
        // thumbnailUrl failed → try video frame capture as fallback
        if (!didCapture.current) {
          didCapture.current = true;
          captureVideoFrame(videoUrl)
            .then((dataUrl) => setImgSrc(dataUrl))
            .catch(() => setErrored(true));
        } else {
          setErrored(true);
        }
      }}
    />
  );
}

/** Full-content fallback for visitors who prefer a conventional list. */
export function ArtworkListView({ artworks, onBack, onSelect, canReturnTo3d, onReturnToEntrance }: ArtworkListViewProps) {
  return (
    <main className="min-h-screen bg-[#eef1ef] text-[#071a2c]">
      <header className="border-b border-[#d4dce0] bg-[#fbfaf7]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-5">
          <div>
            <p className="hidden text-xs font-bold tracking-[0.18em] text-[#5e8a79] sm:block">HANHOLL VIDEO EXHIBITION</p>
            <h1 className="mt-0.5 text-lg font-bold tracking-tight text-[#071a2c] sm:mt-1 sm:text-2xl">작품 목록 보기</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onReturnToEntrance && (
              <button
                className="flex items-center gap-1.5 rounded-sm border border-[#b7c4c9] bg-white p-2 text-xs font-bold text-[#b45b5b] transition hover:bg-[#faeded] sm:px-4 sm:py-2.5 sm:text-sm sm:gap-2"
                type="button"
                onClick={onReturnToEntrance}
              >
                <Home aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">처음 화면으로</span>
              </button>
            )}
            {canReturnTo3d && (
              <button
                className="flex items-center gap-1.5 rounded-sm border border-[#b7c4c9] bg-white p-2 text-xs font-bold transition hover:bg-[#edf1ef] sm:px-4 sm:py-2.5 sm:text-sm sm:gap-2"
                type="button"
                onClick={onBack}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">3D 전시관</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-9">
        <p className="max-w-2xl text-sm leading-7 text-[#5b6874]">3D 전시관과 동일한 작품을 목록으로 확인할 수 있습니다. 작품을 선택하면 팀별 캡션과 영상을 볼 수 있습니다.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artworks.map((artwork) => (
            <button key={artwork.id} className="group overflow-hidden rounded-sm border border-[#d4dce0] bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl" type="button" onClick={() => onSelect(artwork)}>
              {/* Thumbnail — visible only in list view, not in the video player */}
              <div className={`relative aspect-video overflow-hidden bg-gradient-to-br ${accentClassNames[artwork.accent]}`}>
                <ThumbnailImage
                  thumbnailUrl={artwork.thumbnailUrl}
                  videoUrl={artwork.videoUrl}
                  alt={`${artwork.title} 썸네일`}
                />
                {/* Overlay gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 text-xs font-bold tracking-[0.18em] text-white/90">{artwork.teamLabel}</span>
                <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur-sm">
                  <Play aria-hidden="true" className="ml-0.5 h-4 w-4" />
                </span>
              </div>
              <div className="p-5">
                <p className="text-base font-bold leading-snug tracking-tight text-[#071a2c]">{artwork.title}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5b6874]">{artwork.caption}</p>
                <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#31516a]"><Users aria-hidden="true" className="h-4 w-4" />{artwork.studentNames.join(" · ")}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
