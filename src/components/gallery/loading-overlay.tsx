"use client";

import { Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";

type LoadingOverlayProps = {
  /** True once the scene has drawn its first stable frames with all images in place. */
  isReady: boolean;
  /** 0-100, share of scene images (thumbnails, landscape) already loaded. */
  progress: number;
};

const FADE_MS = 500;

/**
 * Full-screen cover shown from the moment the visitor enters until the 3D hall
 * is actually drawn, so a slow laptop never looks like a frozen black screen.
 */
export function LoadingOverlay({ isReady, progress }: LoadingOverlayProps) {
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    const timeoutId = window.setTimeout(() => setIsMounted(false), FADE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isReady]);

  if (!isMounted && isReady) return null;

  const percent = Math.max(0, Math.min(100, Math.round(progress)));
  const message = isReady ? "전시관에 들어갑니다" : percent < 100 ? "작품을 벽에 거는 중입니다" : "조명을 켜는 중입니다";

  return (
    <div
      aria-busy={!isReady}
      aria-live="polite"
      className={`loading-overlay absolute inset-0 z-30 grid place-items-center bg-[#0f1114] transition-opacity duration-500 ${isReady ? "pointer-events-none opacity-0" : "opacity-100"}`}
      role="status"
    >
      <div className="flex w-[min(80vw,320px)] flex-col items-center text-center text-[#f4efe6]">
        <div className="relative grid h-20 w-20 place-items-center">
          <span aria-hidden="true" className="loading-ring absolute inset-0 rounded-full border-2 border-white/10 border-t-[#f4efe6]" />
          <Clapperboard aria-hidden="true" className="h-8 w-8 text-[#f4efe6]" />
        </div>
        <p className="mt-6 text-[11px] font-bold tracking-[0.22em] text-[#8fc4ad]">HANHOLL VIDEO EXHIBITION</p>
        <p className="mt-2 text-lg font-bold tracking-tight">3D 전시관을 준비하고 있습니다</p>
        <div aria-hidden="true" className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#f4efe6] transition-[width] duration-300" style={{ width: `${Math.max(percent, 4)}%` }} />
        </div>
        <p className="mt-3 flex w-full justify-between text-xs text-white/60">
          <span>{message}</span>
          <span className="tabular-nums">{percent}%</span>
        </p>
      </div>
    </div>
  );
}
