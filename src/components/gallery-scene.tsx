"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ShowcaseVideo } from "@/types/showcase";
import { captureVideoFrame } from "@/lib/video-utils";

type GallerySceneProps = {
  artworks: ShowcaseVideo[];
  onSelect: (artwork: ShowcaseVideo) => void;
};

const accentColors = {
  pine: "#477a69",
  hydrangea: "#8475a8",
  navy: "#2f6d91",
};

function createSurfaceTexture(type: "wall" | "floor", repeatX: number, repeatY: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = type === "wall" ? "#e8e5de" : "#cfc7b7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = type === "wall" ? 2 : 3;

  for (let index = 0; index <= 4; index += 1) {
    const offset = index * 128;
    context.strokeStyle = type === "wall" ? "rgba(199, 194, 184, .45)" : "rgba(247, 241, 229, .62)";
    context.beginPath();
    context.moveTo(0, offset);
    context.lineTo(512, offset);
    context.stroke();
    context.strokeStyle = type === "wall" ? "rgba(255, 255, 255, .34)" : "rgba(151, 140, 123, .38)";
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset, 512);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createExhibitionWallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createLinearGradient(0, 0, 1024, 512);
  gradient.addColorStop(0, "#123a55");
  gradient.addColorStop(1, "#071a2c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(45, 90, 73, .74)";
  context.beginPath();
  context.arc(830, 70, 300, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(132, 117, 168, .54)";
  context.beginPath();
  context.arc(130, 500, 280, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(251, 250, 247, .28)";
  context.lineWidth = 2;
  context.strokeRect(82, 72, 860, 360);
  context.fillStyle = "#fbfaf7";
  context.font = "700 48px sans-serif";
  context.textAlign = "center";
  context.fillText("한홀중학교 학생 영상 작품전", 512, 222);
  context.fillStyle = "#d8e3e2";
  context.font = "bold 22px sans-serif";
  context.fillText("존중 · 협력 · 성장", 512, 284);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEntranceSideWallTexture(side: "left" | "right") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // 실내 벽: 전시장 복도 및 옆벽 톤과 자연스럽게 매칭되는 밝은 웜그레이
  context.fillStyle = "#edebe6";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.textAlign = "center";

  if (side === "left") {
    context.fillStyle = "#1b2f3f"; // 품격 있는 딥 네이비로 시인성 향상
    context.font = "bold 24px sans-serif";
    context.fillText("한홀중학교", 128, 230);
    context.fillStyle = "#536c7a"; // 세련된 블루그레이 서브 타이틀
    context.font = "normal 13px sans-serif";
    context.fillText("학생 영상 성과발표회", 128, 275);
  } else {
    context.fillStyle = "#1b2f3f";
    context.font = "bold 19px sans-serif";
    context.fillText("서로를 밝히며", 128, 215);
    context.fillText("함께 성장하는 한홀", 128, 250);
    context.fillStyle = "#3a6857"; // 짙은 소나무 민트 그린으로 한홀 아이덴티티 강조
    context.font = "italic 13px sans-serif";
    context.fillText("존중 · 협력 · 성장", 128, 300);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlassWindowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // 배경 투명 처리
  context.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 유리의 세련된 햇살 반사광 (흰색 투명 사선 강조)
  context.strokeStyle = "rgba(255, 255, 255, 0.35)";
  context.lineWidth = 14;
  context.beginPath();
  context.moveTo(70, 0);
  context.lineTo(0, 70);
  context.moveTo(260, 0);
  context.lineTo(0, 260);
  context.moveTo(512, 90);
  context.lineTo(90, 512);
  context.stroke();

  // 2. 창틀 격자 테두리 및 대형 출입문 프레임 (밝고 세련된 샴페인 메탈릭 실버)
  context.strokeStyle = "#cfcbbd"; 
  context.lineWidth = 10;
  context.strokeRect(0, 0, canvas.width, canvas.height);
  
  context.beginPath();
  // 양개형 도어 세로 분할 틈새선 (중앙선)
  context.moveTo(256, 0);
  context.lineTo(256, 512);
  // 가로 프레임 분할선 (상단 15% 지점)
  context.moveTo(0, 76);
  context.lineTo(512, 76);
  context.stroke();

  // 3. 메탈릭 도어 손잡이 (Pull Handles) 드로잉
  // 중앙 문틈선 좌우 대칭으로 세로로 긴 직사각형 도어 핸들 바(Bar) 묘사
  context.fillStyle = "#b5b0a3"; // 차분한 메탈릭 실버그레이
  context.strokeStyle = "#cfcbbd";
  context.lineWidth = 2;
  
  // 좌측 손잡이 바
  context.fillRect(240, 200, 10, 160);
  context.strokeRect(240, 200, 10, 160);
  
  // 우측 손잡이 바
  context.fillRect(262, 200, 10, 160);
  context.strokeRect(262, 200, 10, 160);

  // 손잡이 연결 브래킷 묘사
  context.fillStyle = "#cfcbbd";
  context.fillRect(236, 215, 6, 8);
  context.fillRect(236, 335, 6, 8);
  context.fillRect(270, 215, 6, 8);
  context.fillRect(270, 335, 6, 8);

  // 4. 상단 중앙 비상 유도등 (EXIT SIGN) 드로잉
  // 가로 프레임 상단 중앙에 밝은 그린 형광 빛의 비상 유도등 묘사
  const exitX = 226;
  const exitY = 16;
  const exitW = 60;
  const exitH = 34;

  // 유도등 사각 바디 채색 (밝은 그린)
  context.fillStyle = "#2eb35a";
  context.beginPath();
  context.roundRect(exitX, exitY, exitW, exitH, 4);
  context.fill();

  // 흰색 하이라이트 테두리
  context.strokeStyle = "rgba(255, 255, 255, 0.4)";
  context.lineWidth = 2;
  context.stroke();

  // "EXIT" 명예 텍스트 드로잉 (흰색 발광 느낌)
  context.fillStyle = "#ffffff";
  context.font = "bold 13px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("EXIT", exitX + exitW / 2, exitY + exitH / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFallbackPosterTexture(title: string, teamLabel: string, accentColor: string, isPortrait: boolean) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = isPortrait ? 512 : 1024;
  canvas.height = isPortrait ? 1024 : 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(1, "#071a2c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border frame
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 12;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  ctx.fillStyle = "#fbfaf7";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Team info
  ctx.font = `800 ${isPortrait ? "38px" : "28px"} sans-serif`;
  ctx.fillText(teamLabel, canvas.width / 2, canvas.height / 2 - (isPortrait ? 80 : 40));

  // Title text wrapping
  ctx.font = `bold ${isPortrait ? "46px" : "36px"} sans-serif`;
  const maxW = canvas.width - 96;
  let displayTitle = title;
  if (ctx.measureText(displayTitle).width > maxW) {
    displayTitle = displayTitle.slice(0, 11) + "...";
  }
  ctx.fillText(displayTitle, canvas.width / 2, canvas.height / 2 + (isPortrait ? 20 : 20));

  // Decor text
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = `${isPortrait ? "24px" : "18px"} sans-serif`;
  ctx.fillText("VIDEO SHOWCASE", canvas.width / 2, canvas.height / 2 + (isPortrait ? 160 : 80));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Keeps movement simple for an exhibition laptop: WASD or arrow keys walk the
 * hall, and dragging the mouse changes the viewing direction.
 */
function VisitorController({ hallLength }: { hallLength: number }) {
  const keys = useRef(new Set<string>());
  const dragging = useRef(false);
  const previousPointer = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.key);
      keys.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.key);
      keys.current.delete(event.code);
    };
    const onMouseDown = (event: MouseEvent) => {
      dragging.current = true;
      previousPointer.current = { x: event.clientX, y: event.clientY };
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      const deltaX = event.clientX - previousPointer.current.x;
      const deltaY = event.clientY - previousPointer.current.y;
      previousPointer.current = { x: event.clientX, y: event.clientY };
      yaw.current -= deltaX * 0.004;
      pitch.current = THREE.MathUtils.clamp(pitch.current - deltaY * 0.003, -0.72, 0.72);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        dragging.current = true;
        previousPointer.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
    };
    const onTouchEnd = () => {
      dragging.current = false;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!dragging.current || event.touches.length !== 1) return;
      const deltaX = event.touches[0].clientX - previousPointer.current.x;
      const deltaY = event.touches[0].clientY - previousPointer.current.y;
      previousPointer.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      yaw.current -= deltaX * 0.004;
      pitch.current = THREE.MathUtils.clamp(pitch.current - deltaY * 0.003, -0.72, 0.72);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  useFrame(({ camera }, delta) => {
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const movement = new THREE.Vector3();
    if (keys.current.has("w") || keys.current.has("KeyW") || keys.current.has("ArrowUp")) movement.add(forward);
    if (keys.current.has("s") || keys.current.has("KeyS") || keys.current.has("ArrowDown")) movement.sub(forward);
    if (keys.current.has("d") || keys.current.has("KeyD") || keys.current.has("ArrowRight")) movement.add(right);
    if (keys.current.has("a") || keys.current.has("KeyA") || keys.current.has("ArrowLeft")) movement.sub(right);
    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar(delta * 4.2);
      camera.position.add(movement);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -4.4, 4.4);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -hallLength + 5, 1.8);
    }
    camera.position.y = 1.72;
  });

  return null;
}

function ArtworkPanel({ artwork, index, onSelect }: { artwork: ShowcaseVideo; index: number; onSelect: (artwork: ShowcaseVideo) => void }) {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  const rotation: [number, number, number] = [0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0];

  const [thumbTexture, setThumbTexture] = useState<THREE.Texture | null>(null);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(artwork.orientation || "landscape");

  useEffect(() => {
    let alive = true;

    const applyDataUrl = (dataUrl: string) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        dataUrl,
        (tex) => {
          if (!alive) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          setThumbTexture(tex);
          if (!artwork.orientation) {
            const img = tex.image;
            const w = img ? (img.naturalWidth || img.width || 0) : 0;
            const h = img ? (img.naturalHeight || img.height || 0) : 0;
            setOrientation(h > w ? "portrait" : "landscape");
          }
        }
      );
    };

    const tryVideoFrame = () =>
      captureVideoFrame(artwork.videoUrl)
        .then((dataUrl) => { if (alive) applyDataUrl(dataUrl); })
        .catch(() => {});

    if (artwork.thumbnailUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        artwork.thumbnailUrl,
        (tex) => {
          if (!alive) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          setThumbTexture(tex);
          if (!artwork.orientation) {
            const img = tex.image;
            const w = img ? (img.naturalWidth || img.width || 0) : 0;
            const h = img ? (img.naturalHeight || img.height || 0) : 0;
            setOrientation(h > w ? "portrait" : "landscape");
          }
        },
        undefined,
        () => { if (alive) tryVideoFrame(); },
      );
    } else {
      tryVideoFrame();
    }

    return () => {
      alive = false;
    };
  }, [artwork.thumbnailUrl, artwork.videoUrl]);

  // Frame dimensions vary by orientation
  const isPortrait = orientation === "portrait";
  const frameW = isPortrait ? 1.65 : 3.05;
  const frameH = isPortrait ? 2.95 : 2.05;
  const imgW  = isPortrait ? 1.38 : 2.76;
  const imgH  = isPortrait ? 2.46 : 1.48;
  const posY  = isPortrait ? 2.15 : 1.9;
  const moldW = isPortrait ? 1.92 : 3.35;
  const moldY = isPortrait ? -1.6 : -1.2;
  // Label positioned beside lower edge of frame
  const labelX = isPortrait ? frameW * 0.5 + 0.45 : frameW * 0.5 + 0.45;
  const labelY = isPortrait ? -frameH * 0.5 + 0.45 : -frameH * 0.5 + 0.5;

  const position: [number, number, number] = [side * 5.72, posY, -3.8 - row * 4.5];

  const fallbackTexture = useMemo(() => {
    return createFallbackPosterTexture(
      artwork.title,
      artwork.teamLabel,
      accentColors[artwork.accent],
      isPortrait
    );
  }, [artwork.title, artwork.teamLabel, artwork.accent, isPortrait]);

  return (
    <group position={position} rotation={rotation}>
      {/* Outer frame / mat board */}
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(artwork); }}>
        <boxGeometry args={[frameW, frameH, 0.12]} />
        <meshStandardMaterial color="#f6f2e9" roughness={0.78} />
      </mesh>
      {/* Artwork image / accent backdrop */}
      <mesh position={[0, 0.08, 0.08]} onClick={(event) => { event.stopPropagation(); onSelect(artwork); }}>
        <planeGeometry args={[imgW, imgH]} />
        <meshStandardMaterial 
          map={thumbTexture || fallbackTexture || undefined} 
          roughness={0.55} 
        />
      </mesh>
      {/* Caption label */}
      <Html center position={[labelX, labelY, 0.13]} transform distanceFactor={3.8} zIndexRange={[5, 0]} wrapperClass="hallway-label">
        <button
          aria-label={`${artwork.teamLabel} ${artwork.title} ${artwork.studentNames.join(" ")} 상세 보기`}
          className="gallery-caption cursor-pointer"
          style={{ "--caption-accent": accentColors[artwork.accent] } as React.CSSProperties}
          type="button"
          onClick={(event) => { event.stopPropagation(); onSelect(artwork); }}
        >
          <span className="gallery-team">{artwork.teamLabel}</span>
          <strong>{artwork.title}</strong>
          <span className="gallery-students">{artwork.studentNames.join(" · ")}</span>
        </button>
      </Html>
      {/* Picture rail / moulding strip */}
      <mesh position={[0, moldY, 0.02]}>
        <boxGeometry args={[moldW, 0.12, 0.1]} />
        <meshStandardMaterial color="#9a855f" roughness={0.8} />
      </mesh>
    </group>
  );
}

function GalleryHall({ artworks, onSelect }: GallerySceneProps) {
  const hallLength = Math.max(29, Math.ceil(artworks.length / 2) * 4.5 + 7);
  const wallTexture = useMemo(
    () => createSurfaceTexture("wall", 1.2, hallLength / 4),
    [hallLength],
  );
  const floorTexture = useMemo(
    () => createSurfaceTexture("floor", 4, hallLength / 4),
    [hallLength],
  );
  const exhibitionWallTexture = useMemo(() => createExhibitionWallTexture(), []);
  const entranceLeftWallTexture = useMemo(() => createEntranceSideWallTexture("left"), []);
  const entranceRightWallTexture = useMemo(() => createEntranceSideWallTexture("right"), []);
  const glassWindowTexture = useMemo(() => createGlassWindowTexture(), []);

  // [NEW] AI 생성 고해상도 실사 전경 이미지 비동기 로드
  const [loadedLandscape, setLoadedLandscape] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/media/landscape.png`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      setLoadedLandscape(texture);
    });
  }, []);

  return (
    <>
      <color attach="background" args={["#dce3e3"]} />
      <fog attach="fog" args={["#dce3e3", 14, 38]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 7, 3]} intensity={1.6} />
      <pointLight position={[0, 3, -10]} intensity={12} distance={22} color="#d9e6df" />
      <pointLight position={[0, 3, -21]} intensity={12} distance={20} color="#d7cfe7" />

      <mesh position={[0, -0.09, -hallLength / 2 + 3]}><boxGeometry args={[12, 0.18, hallLength]} /><meshStandardMaterial map={floorTexture} color="#ddd8cc" roughness={0.92} /></mesh>
      <mesh position={[-6, 2.9, -hallLength / 2 + 3]}><boxGeometry args={[0.24, 6, hallLength]} /><meshStandardMaterial map={wallTexture} color="#e9e6df" roughness={0.9} /></mesh>
      <mesh position={[6, 2.9, -hallLength / 2 + 3]}><boxGeometry args={[0.24, 6, hallLength]} /><meshStandardMaterial map={wallTexture} color="#e9e6df" roughness={0.9} /></mesh>
      <mesh position={[0, 5.75, -hallLength / 2 + 3]}><boxGeometry args={[12, 0.18, hallLength]} /><meshStandardMaterial color="#f3f0e8" roughness={0.94} /></mesh>
      
      {/* 1. 복도 맨 끝 정면 벽 */}
      <mesh position={[0, 2.9, -hallLength + 3]}><boxGeometry args={[12, 6, 0.24]} /><meshStandardMaterial map={exhibitionWallTexture} roughness={0.84} /></mesh>
      
      {/* 2. 복도 입구 벽면 (좌/우측 실내 벽 & 중앙 투명 격자창 분할 렌더링) */}
      {/* 복도의 z = 3 경계선 끝에 자석처럼 딱 붙여 렌더링하여 양옆 긴 벽면과 빈틈없이 가득 차도록 보정 */}
      {/* 좌측 실내 벽 (가로 3, 세로 6, 두께 0.24, 위치 x = -4.5, z = 3) */}
      <mesh position={[-4.5, 2.9, 3]}><boxGeometry args={[3, 6, 0.24]} /><meshStandardMaterial map={entranceLeftWallTexture} roughness={0.84} /></mesh>
      
      {/* 우측 실내 벽 (가로 3, 세로 6, 두께 0.24, 위치 x = 4.5, z = 3) */}
      <mesh position={[4.5, 2.9, 3]}><boxGeometry args={[3, 6, 0.24]} /><meshStandardMaterial map={entranceRightWallTexture} roughness={0.84} /></mesh>
      
      {/* 중앙 통유리창 (가로 6, 세로 6, 두께 0.05, 위치 x = 0, z = 3) */}
      <mesh position={[0, 2.9, 3]}>
        <boxGeometry args={[6, 6, 0.05]} />
        <meshStandardMaterial 
          map={glassWindowTexture} 
          transparent={true} 
          roughness={0.1} 
          metalness={0.82} 
        />
      </mesh>

      {/* 3. 3D 입체 원근감을 만드는 창밖 풍경 백그라운드 레이어 (Parallax Layer) */}
      {/* 우주적인 Gemini 오로라 테마의 고해상도 풍경을 z = 7.5 에 두어 시차 깊이 극대화 */}
      {loadedLandscape && (
        <mesh position={[0, 2.9, 7.5]}>
          <planeGeometry args={[18, 9]} />
          <meshBasicMaterial map={loadedLandscape} depthWrite={false} />
        </mesh>
      )}

      {Array.from({ length: Math.ceil(hallLength / 4) }).map((_, index) => (
        <mesh key={index} position={[0, 5.58, 1.5 - index * 4]}>
          <boxGeometry args={[5.6, 0.08, 0.65]} />
          <meshStandardMaterial color={index % 3 === 2 ? "#c9bedb" : "#dbe5df"} emissive={index % 3 === 2 ? "#635679" : "#526e65"} emissiveIntensity={0.32} />
        </mesh>
      ))}
      {artworks.map((artwork, index) => <ArtworkPanel key={artwork.id} artwork={artwork} index={index} onSelect={onSelect} />)}
      <VisitorController hallLength={hallLength} />
    </>
  );
}

/** WebGL scene using local text overlays and primitive geometry only. */
export function GalleryScene({ artworks, onSelect, isVideoPlaying }: GallerySceneProps & { isVideoPlaying?: boolean }) {
  return (
    <Canvas 
      camera={{ fov: 62, near: 0.1, far: 80, position: [0, 1.72, 0] }} 
      dpr={[1, 1.5]} 
      gl={{ antialias: true }}
      frameloop={isVideoPlaying ? "never" : "always"}
    >
      <GalleryHall artworks={artworks} onSelect={onSelect} />
    </Canvas>
  );
}
