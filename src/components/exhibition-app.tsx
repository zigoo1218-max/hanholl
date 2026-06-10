"use client";

import dynamic from "next/dynamic";
import { Building2, Grid3X3, Home, Info, MousePointer2, Move, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ArtworkDialog } from "@/components/artwork-dialog";
import { ArtworkListView } from "@/components/artwork-list-view";
import { EntranceScreen } from "@/components/entrance-screen";
import { showcaseVideos } from "@/data/showcase-videos";
import type { ShowcaseVideo } from "@/types/showcase";

const GalleryScene = dynamic(() => import("@/components/gallery-scene").then((module) => module.GalleryScene), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-[#dce3e3] text-sm font-semibold text-[#31516a]">3D 전시관을 준비하고 있습니다.</div>,
});

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

/** Coordinates entrance, 3D exhibition, fallback list, and caption dialog. */
export function ExhibitionApp() {
  const [entered, setEntered] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "list">("3d");
  const [selectedArtwork, setSelectedArtwork] = useState<ShowcaseVideo | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [artworks, setArtworks] = useState<ShowcaseVideo[]>(showcaseVideos);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const activeArtwork = selectedArtwork ? (artworks.find(a => a.id === selectedArtwork.id) || selectedArtwork) : null;

  useEffect(() => {
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);
  }, []);

  useEffect(() => {
    if (!entered || isVideoPlaying) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setEntered(false);
        setViewMode("3d");
        setSelectedArtwork(null);
        setIsVideoPlaying(false);
      }, 60000);
    };

    resetTimer();

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [entered, isVideoPlaying]);

  useEffect(() => {
    const loadAllInfo = async () => {
      const timestamp = new Date().getTime();
      const updated = await Promise.all(
        showcaseVideos.map(async (video) => {
          const folderName = video.id.replace("team-", "team").replace("0", "");
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/media/${folderName}/info.json?v=${timestamp}`);

            if (res.ok) {
              const info = await res.json();
              return {
                ...video,
                title: info.title || video.title,
                caption: info.caption || video.caption,
                studentNames: info.studentNames || video.studentNames,
              };
            }
          } catch (err) {
            console.warn(`Failed to load info for ${video.id}`, err);
          }
          return video;
        })
      );
      setArtworks(updated);
    };
    loadAllInfo();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setWebglAvailable(canUseWebGL());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!entered) return <EntranceScreen onEnter={() => setEntered(true)} />;

  if (viewMode === "list" || !webglAvailable) {
    return (
      <>
        <ArtworkListView
          artworks={artworks}
          canReturnTo3d={webglAvailable}
          onBack={() => setViewMode("3d")}
          onSelect={setSelectedArtwork}
          onReturnToEntrance={() => {
            setEntered(false);
            setViewMode("3d");
            setSelectedArtwork(null);
            setIsVideoPlaying(false);
          }}
        />
        {!webglAvailable && <div className="fixed bottom-4 left-1/2 z-30 w-[min(92vw,620px)] -translate-x-1/2 rounded-sm border border-[#c5d0d2] bg-white px-4 py-3 text-center text-xs leading-5 text-[#53636f] shadow-lg">이 브라우저에서는 3D 화면을 사용할 수 없어 작품 목록으로 안내합니다.</div>}
        <ArtworkDialog
          key={activeArtwork?.id ?? "empty"}
          artwork={activeArtwork}
          onClose={() => {
            setSelectedArtwork(null);
            setIsVideoPlaying(false);
          }}
          onVideoPlayingChange={setIsVideoPlaying}
        />
      </>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#dce3e3]">
      <GalleryScene artworks={artworks} onSelect={setSelectedArtwork} isVideoPlaying={isVideoPlaying} />
      <header className="glass-panel absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2 rounded-sm px-3 py-2.5 sm:inset-x-6 sm:top-4 sm:px-5 sm:py-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0b263f] text-white sm:grid">
            <Building2 aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold tracking-[0.18em] text-[#5e8a79] sm:block">HANHOLL VIDEO EXHIBITION</p>
            <h1 className="truncate text-sm font-bold tracking-tight text-[#071a2c] sm:text-lg">
              한홀중학교 학생 영상 작품전
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-sm border border-[#b7c4c9] bg-white p-2 text-xs font-bold text-[#b45b5b] transition hover:bg-[#faeded] sm:px-4 sm:py-2 sm:text-sm sm:gap-2"
            type="button"
            onClick={() => {
              setEntered(false);
              setViewMode("3d");
              setSelectedArtwork(null);
              setIsVideoPlaying(false);
            }}
          >
            <Home aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">처음 화면으로</span>
          </button>
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-sm border border-[#b7c4c9] bg-white p-2 text-xs font-bold text-[#23465e] transition hover:bg-[#edf1ef] sm:px-4 sm:py-2 sm:text-sm sm:gap-2"
            type="button"
            onClick={() => setViewMode("list")}
          >
            <Grid3X3 aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">작품 목록</span>
          </button>
        </div>
      </header>

      <aside className="glass-panel absolute bottom-20 left-4 z-20 max-w-[calc(100vw-2rem)] rounded-sm px-4 py-3 sm:bottom-6 sm:left-6">
        <p className="flex items-center gap-2 text-xs font-bold text-[#23465e]"><Info aria-hidden="true" className="h-4 w-4" />전시관 조작 안내</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-[#5b6874]">
          {isTouchDevice ? (
            <>
              <span className="flex items-center gap-1.5"><Move aria-hidden="true" className="h-3.5 w-3.5" />우측 하단 방향키 터치 이동</span>
              <span className="flex items-center gap-1.5"><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />화면 터치 드래그 시점 이동</span>
              <span className="flex items-center gap-1.5"><MousePointer2 aria-hidden="true" className="h-3.5 w-3.5" />작품 터치 상세 보기</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5"><Move aria-hidden="true" className="h-3.5 w-3.5" />방향키 또는 W A S D 이동</span>
              <span className="flex items-center gap-1.5"><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />마우스 드래그 시점 이동</span>
              <span className="flex items-center gap-1.5"><MousePointer2 aria-hidden="true" className="h-3.5 w-3.5" />작품 클릭 상세 보기</span>
            </>
          )}
        </div>
      </aside>

      {/* 가상 방향키 (D-pad) */}
      {isTouchDevice && (
        <div className="absolute bottom-20 right-4 z-20 flex flex-col items-center gap-1 bg-white/10 p-3 rounded-full border border-white/20 backdrop-blur-md shadow-lg select-none sm:bottom-8">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/40 border border-white/20 active:bg-white/80 active:scale-95 transition"
            onTouchStart={(e) => {
              e.preventDefault();
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", code: "ArrowUp" }));
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp", code: "ArrowUp" }));
            }}
          >
            <ChevronUp className="h-6 w-6 text-[#071a2c]" />
          </button>
          <div className="flex gap-4">
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/40 border border-white/20 active:bg-white/80 active:scale-95 transition"
              onTouchStart={(e) => {
                e.preventDefault();
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", code: "ArrowLeft" }));
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", code: "ArrowLeft" }));
              }}
            >
              <ChevronLeft className="h-6 w-6 text-[#071a2c]" />
            </button>
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/40 border border-white/20 active:bg-white/80 active:scale-95 transition"
              onTouchStart={(e) => {
                e.preventDefault();
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", code: "ArrowRight" }));
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", code: "ArrowRight" }));
              }}
            >
              <ChevronRight className="h-6 w-6 text-[#071a2c]" />
            </button>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/40 border border-white/20 active:bg-white/80 active:scale-95 transition"
            onTouchStart={(e) => {
              e.preventDefault();
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown" }));
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown", code: "ArrowDown" }));
            }}
          >
            <ChevronDown className="h-6 w-6 text-[#071a2c]" />
          </button>
        </div>
      )}

      <ArtworkDialog
        key={activeArtwork?.id ?? "empty"}
        artwork={activeArtwork}
        onClose={() => {
          setSelectedArtwork(null);
          setIsVideoPlaying(false);
        }}
        onVideoPlayingChange={setIsVideoPlaying}
      />
    </main>
  );
}
