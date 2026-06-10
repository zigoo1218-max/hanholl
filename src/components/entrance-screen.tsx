"use client";

import { ArrowRight, Building2, Flower2, Trees } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type EntranceScreenProps = {
  onEnter: () => void;
};

/**
 * Event entrance with an optional local promotional video.
 * The CTA remains available when autoplay or the media file fails.
 */
export function EntranceScreen({ onEnter }: EntranceScreenProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (videoRef.current?.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        setVideoFailed(true);
      }
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071a2c] text-white">
      {!videoFailed ? (
        <video
          ref={videoRef}
          aria-label="한홀중학교 전경 홍보영상"
          className="absolute inset-0 h-full w-full object-cover opacity-70 scale-112"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
        >
        <source
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/media/school-promo.mp4`}
            type="video/mp4"
            onError={() => setVideoFailed(true)}
          />
        </video>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#486f65_0%,#123553_42%,#071a2c_100%)]" />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,19,33,0.95)_0%,rgba(4,19,33,0.70)_25%,rgba(4,19,33,0.10)_55%,transparent_75%)]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#071a2c] via-[#071a2c]/80 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(7,26,44,1)_0%,rgba(7,26,44,0.8)_25%,transparent_60%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between px-6 py-7 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between border-b border-white/20 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-white/10">
              <Building2 aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs tracking-[0.24em] text-white/65">HANHOLL MIDDLE SCHOOL</p>
              <p className="mt-1 text-base font-semibold tracking-tight">한홀중학교</p>
            </div>
          </div>
          <p className="hidden text-sm text-white/70 sm:block">학생 영상 작품 성과발표회</p>
        </header>

        <section className="max-w-3xl py-16">
          <p className="mb-5 flex items-center gap-3 text-sm font-semibold tracking-[0.2em] text-[#d7d0ea]">
            <span className="h-px w-10 bg-[#a89ac5]" />
            2026 DIGITAL EXHIBITION
          </p>
          <h1 className="text-5xl font-bold leading-[1.12] tracking-[-0.08em] sm:text-7xl">
            서로를 밝히며
            <br />
            함께 성장하는 한홀
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-white/76 sm:text-lg">
            학생들이 함께 기획하고 완성한 영상 작품을 만나보세요.
            <br className="hidden sm:block" />
            전시관을 직접 걸으며 각 팀의 시선과 이야기를 발견할 수 있습니다.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <button className="group flex items-center gap-3 rounded-sm bg-white px-6 py-4 text-sm font-bold text-[#0b263f] shadow-xl transition hover:bg-[#f5f3ee]" type="button" onClick={onEnter}>
              3D 전시관 입장
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/20 pt-5 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-5">
            <span className="flex items-center gap-2"><Trees aria-hidden="true" className="h-4 w-4 text-[#87ab9d]" />교목 소나무</span>
            <span className="flex items-center gap-2"><Flower2 aria-hidden="true" className="h-4 w-4 text-[#b8acd2]" />교화 수국</span>
          </div>
          <p>존중 · 협력 · 성장</p>
        </footer>
      </div>
    </main>
  );
}
