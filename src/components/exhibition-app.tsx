"use client";

import dynamic from "next/dynamic";
import { Clapperboard, Grid3X3, Hand, Home, MousePointer2, Move, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArtworkDialog } from "@/components/artwork-dialog";
import { ArtworkListView } from "@/components/artwork-list-view";
import { EntranceScreen } from "@/components/entrance-screen";
import { computeHallLayout } from "@/components/gallery/layout";
import { SceneErrorBoundary } from "@/components/gallery/scene-error-boundary";
import { createMoveInput, TouchPad } from "@/components/gallery-controls";
import { showcaseVideos } from "@/data/showcase-videos";
import type { ShowcaseVideo } from "@/types/showcase";

const IDLE_RESET_MS = 60000;

/** info.json sits next to the video, so B실 (media/team1) and A실 (media/room-a/team1) works both resolve. */
function infoUrlFor(video: ShowcaseVideo) {
  return video.videoUrl.replace(/video\.[^/]+$/, "info.json");
}

const GalleryScene = dynamic(() => import("@/components/gallery-scene").then((module) => module.GalleryScene), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[#0f1114] text-sm font-semibold text-[#d9d2c4]">
      <div className="flex flex-col items-center gap-3">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#f4efe6]" />
        3D 전시관을 준비하고 있습니다
      </div>
    </div>
  ),
});

/** Touch state is only consumed after the visitor enters, so the server/client mismatch never reaches the DOM. */
function detectTouchDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

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
  const [isTouchDevice] = useState(detectTouchDevice);
  const moveInput = useRef(createMoveInput());
  const jumpRequest = useRef<number | null>(null);
  const [currentRoom, setCurrentRoom] = useState(0);
  const layout = useMemo(() => computeHallLayout(artworks), [artworks]);
  const handleRoomChange = useCallback((roomIndex: number) => setCurrentRoom(roomIndex), []);
  const takeJumpRequest = useCallback(() => {
    const requested = jumpRequest.current;
    jumpRequest.current = null;
    return requested;
  }, []);

  const activeArtwork = selectedArtwork ? (artworks.find((item) => item.id === selectedArtwork.id) ?? selectedArtwork) : null;

  const returnToEntrance = () => {
    setEntered(false);
    setViewMode("3d");
    setSelectedArtwork(null);
    setIsVideoPlaying(false);
    setCurrentRoom(0);
  };

  const closeDialog = () => {
    setSelectedArtwork(null);
    setIsVideoPlaying(false);
  };

  useEffect(() => {
    if (!entered || isVideoPlaying) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(returnToEntrance, IDLE_RESET_MS);
    };
    resetTimer();

    const events = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [entered, isVideoPlaying]);

  useEffect(() => {
    const loadAllInfo = async () => {
      const timestamp = Date.now();
      const updated = await Promise.all(
        showcaseVideos.map(async (video) => {
          try {
            const response = await fetch(`${infoUrlFor(video)}?v=${timestamp}`);
            if (response.ok) {
              const info = await response.json();
              return {
                ...video,
                title: info.title || video.title,
                caption: info.caption || video.caption,
                studentNames: info.studentNames || video.studentNames,
              };
            }
          } catch (error) {
            console.warn(`Failed to load info for ${video.id}`, error);
          }
          return video;
        }),
      );
      setArtworks(updated);
    };
    void loadAllInfo();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setWebglAvailable(canUseWebGL()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!entered) return <EntranceScreen onEnter={() => setEntered(true)} />;

  if (viewMode === "list" || !webglAvailable) {
    return (
      <>
        <ArtworkListView artworks={artworks} canReturnTo3d={webglAvailable} onBack={() => setViewMode("3d")} onReturnToEntrance={returnToEntrance} onSelect={setSelectedArtwork} />
        {!webglAvailable && (
          <div className="fixed bottom-4 left-1/2 z-30 w-[min(92vw,620px)] -translate-x-1/2 rounded-sm border border-[#c5d0d2] bg-white px-4 py-3 text-center text-xs leading-5 text-[#53636f] shadow-lg">
            이 브라우저에서는 3D 화면을 사용할 수 없어 작품 목록으로 안내합니다.
          </div>
        )}
        <ArtworkDialog key={activeArtwork?.id ?? "empty"} artwork={activeArtwork} onClose={closeDialog} onVideoPlayingChange={setIsVideoPlaying} />
      </>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#0f1114]">
      <SceneErrorBoundary onError={() => setWebglAvailable(false)}>
        <GalleryScene isVideoPlaying={isVideoPlaying} layout={layout} takeJumpRequest={takeJumpRequest} moveInput={moveInput} onRoomChange={handleRoomChange} onSelect={setSelectedArtwork} />
      </SceneErrorBoundary>

      {/* Vignette keeps the HUD legible against bright walls without touching the 3D scene. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(5,8,12,0.55)_100%)]" />

      <header className="hud-panel absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2 rounded-2xl px-3 py-2 sm:inset-x-6 sm:top-5 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f4efe6] text-[#0b1119] sm:h-10 sm:w-10">
            <Clapperboard aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold tracking-[0.22em] text-[#8fc4ad] sm:block">HANHOLL VIDEO EXHIBITION 2026</p>
            <h1 className="truncate text-sm font-bold tracking-tight text-[#f4efe6] sm:text-base">한홀중학교 학생 영상 작품전</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button aria-label="처음 화면으로" className="hud-button" type="button" onClick={returnToEntrance}>
            <Home aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">처음 화면</span>
          </button>
          <button aria-label="작품 목록 보기" className="hud-button hud-button-accent" type="button" onClick={() => setViewMode("list")}>
            <Grid3X3 aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">작품 목록</span>
            <span className="rounded-full bg-[#0b1119]/10 px-1.5 text-[11px] tabular-nums">{artworks.length}</span>
          </button>
        </div>
      </header>

      {/* Room switcher: shows where the visitor is and jumps straight to the other room. */}
      <nav aria-label="전시실 바로가기" className="hud-panel absolute left-1/2 top-[4.25rem] z-20 flex w-max -translate-x-1/2 items-center gap-1 rounded-full p-1 sm:top-[5.25rem]">
        {layout.rooms.map((roomLayout, index) => {
          const isCurrent = index === currentRoom;
          const workCount = roomLayout.slots.filter((slot) => slot.artwork).length;
          return (
            <button
              key={roomLayout.room.id}
              aria-current={isCurrent ? "location" : undefined}
              aria-label={`${roomLayout.room.name}로 이동 (${roomLayout.room.subtitle}, 작품 ${workCount}개)`}
              className={`room-tab ${isCurrent ? "room-tab-active" : ""}`}
              style={{ "--room-accent": roomLayout.room.accent } as React.CSSProperties}
              type="button"
              onClick={() => {
                jumpRequest.current = index;
              }}
            >
              <span className="room-tab-dot" aria-hidden="true" />
              <span className="font-extrabold">{roomLayout.room.name}</span>
              <span className="room-tab-sub">{roomLayout.room.subtitle}</span>
            </button>
          );
        })}
      </nav>

      <aside className={`hud-panel absolute bottom-3 left-3 z-20 rounded-2xl px-3.5 py-2.5 sm:bottom-6 sm:left-6 sm:px-4 sm:py-3 ${isTouchDevice ? "max-w-[calc(100vw-13.5rem)]" : "max-w-[min(92vw,30rem)]"}`}>
        {isTouchDevice ? (
          <div className="flex flex-col gap-1.5">
            <span className="hud-chip"><Hand aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />끌어서 둘러보기</span>
            <span className="hud-chip"><Move aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />패드로 걷기</span>
            <span className="hud-chip"><MousePointer2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />작품을 눌러 재생</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="hud-chip"><Move aria-hidden="true" className="h-3.5 w-3.5" /><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 방향키 이동</span>
            <span className="hud-chip"><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />마우스 드래그로 둘러보기</span>
            <span className="hud-chip"><MousePointer2 aria-hidden="true" className="h-3.5 w-3.5" />작품 클릭으로 영상 보기</span>
          </div>
        )}
      </aside>

      {/* Keyboard and screen-reader path to each artwork; the 3D canvas itself is not focusable. */}
      <nav aria-label="작품 바로가기" className="sr-only">
        {layout.rooms.map((roomLayout) => {
          const works = roomLayout.slots.flatMap((slot) => (slot.artwork ? [slot.artwork] : []));
          return (
            <section key={roomLayout.room.id} aria-label={`${roomLayout.room.name} ${roomLayout.room.subtitle}`}>
              <p>
                {roomLayout.room.name} {roomLayout.room.subtitle}
                {works.length === 0 ? " — 작품 준비 중" : ""}
              </p>
              <ul>
                {works.map((artwork) => (
                  <li key={artwork.id}>
                    <button type="button" onClick={() => setSelectedArtwork(artwork)}>
                      {artwork.teamLabel} {artwork.title} {artwork.studentNames.join(" ")} 상세 보기
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      {isTouchDevice && (
        <div className="absolute bottom-3 right-3 z-20 sm:bottom-6 sm:right-6">
          <TouchPad inputRef={moveInput} />
        </div>
      )}

      <ArtworkDialog key={activeArtwork?.id ?? "empty"} artwork={activeArtwork} onClose={closeDialog} onVideoPlayingChange={setIsVideoPlaying} />
    </main>
  );
}
