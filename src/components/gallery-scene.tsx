"use client";

import { Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState, type RefObject } from "react";
import * as THREE from "three";
import { ArtworkPanel, FIRST_ROW_Z, ROW_SPACING } from "@/components/gallery/artwork-panel";
import { createEndWallTexture, createEntranceSideWallTexture, createFloorTexture, createGlassDoorTexture, createRadialTexture, createWallTexture } from "@/components/gallery/textures";
import { VisitorController } from "@/components/gallery/visitor-controller";
import type { MoveInput } from "@/components/gallery-controls";
import type { ShowcaseVideo } from "@/types/showcase";

type GallerySceneProps = {
  artworks: ShowcaseVideo[];
  moveInput: RefObject<MoveInput>;
  onSelect: (artwork: ShowcaseVideo) => void;
  isVideoPlaying?: boolean;
};

const HALL_WIDTH = 12;
const WALL_X = HALL_WIDTH / 2;
const CEILING_Y = 5.75;
const ENTRANCE_Z = 3;
const MIN_HALL_LENGTH = 29;
const BACKGROUND = "#0f1114";
const WALL_COLOR = "#e6dfd2";
const TRACK_X = 4.2;
/** Above this many works, per-frame spotlights are dropped (light pools remain) to keep the light count sane on laptop GPUs. */
const MAX_SPOTLIT_ARTWORKS = 12;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function hallLengthFor(count: number) {
  return Math.max(MIN_HALL_LENGTH, Math.ceil(count / 2) * ROW_SPACING + 10);
}

function useTextures(hallLength: number) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const textures = useMemo(() => {
    // Side-wall box faces map u along the hall length and v along the height.
    const wall = createWallTexture(hallLength / 4, 1.6);
    const floor = createFloorTexture(HALL_WIDTH / 2, hallLength / 2);
    if (wall) wall.anisotropy = maxAnisotropy;
    if (floor) floor.anisotropy = maxAnisotropy;
    return {
      wall,
      floor,
      endWall: createEndWallTexture(),
      entranceLeft: createEntranceSideWallTexture("left"),
      entranceRight: createEntranceSideWallTexture("right"),
      glass: createGlassDoorTexture(),
      glow: createRadialTexture("rgba(255, 244, 226, 0.9)", "rgba(255, 244, 226, 0)"),
    };
  }, [hallLength, maxAnisotropy]);

  useEffect(() => () => Object.values(textures).forEach((texture) => texture?.dispose()), [textures]);
  return textures;
}

type Textures = ReturnType<typeof useTextures>;

/** Reflective floor on capable devices; plain dark stone on touch or low-core devices. */
function Floor({ hallLength, map, isHighQuality }: { hallLength: number; map: THREE.Texture | null; isHighQuality: boolean }) {
  const centerZ = -hallLength / 2 + ENTRANCE_Z;
  return (
    <mesh position={[0, 0, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[HALL_WIDTH, hallLength]} />
      {isHighQuality ? (
        <MeshReflectorMaterial blur={[320, 90]} color="#4a4d54" depthScale={1.2} map={map ?? undefined} maxDepthThreshold={1.8} metalness={0.4} minDepthThreshold={0.4} mirror={0} mixBlur={1} mixStrength={2.6} resolution={1024} roughness={0.5} />
      ) : (
        <meshStandardMaterial color="#44474d" map={map ?? undefined} metalness={0.3} roughness={0.6} />
      )}
    </mesh>
  );
}

function Walls({ hallLength, map }: { hallLength: number; map: THREE.Texture | null }) {
  const centerZ = -hallLength / 2 + ENTRANCE_Z;
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * WALL_X, 0, centerZ]}>
          <mesh position={[0, CEILING_Y / 2, 0]}>
            <boxGeometry args={[0.24, CEILING_Y, hallLength]} />
            <meshStandardMaterial color={WALL_COLOR} map={map ?? undefined} roughness={0.96} />
          </mesh>
          {/* Dark baseboard and a slim cove light where wall meets ceiling. */}
          <mesh position={[-side * 0.13, 0.09, 0]}>
            <boxGeometry args={[0.03, 0.18, hallLength]} />
            <meshStandardMaterial color="#1b1a18" roughness={0.6} />
          </mesh>
          <mesh position={[-side * 0.16, CEILING_Y - 0.14, 0]}>
            <boxGeometry args={[0.08, 0.04, hallLength]} />
            <meshStandardMaterial color="#fff3e0" emissive="#ffe9cc" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, CEILING_Y, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALL_WIDTH, hallLength]} />
        <meshStandardMaterial color="#17191d" roughness={0.95} />
      </mesh>
      {/* Lighting track rails above each artwork column. */}
      {[-1, 1].map((side) => (
        <mesh key={`track-${side}`} position={[side * TRACK_X, CEILING_Y - 0.05, centerZ]}>
          <boxGeometry args={[0.1, 0.08, hallLength - 1]} />
          <meshStandardMaterial color="#121315" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

/** Ceiling fill: one warm downlight per row keeps the walkway readable without washing out artwork. */
function HallLights({ hallLength, rows, glow, isHighQuality }: { hallLength: number; rows: number; glow: THREE.Texture | null; isHighQuality: boolean }) {
  const positions = useMemo(() => Array.from({ length: rows + 1 }, (_, index) => FIRST_ROW_Z + ROW_SPACING / 2 - index * ROW_SPACING), [rows]);
  const endWallTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 2.6, -hallLength + ENTRANCE_Z);
    return target;
  }, [hallLength]);
  return (
    <>
      <ambientLight color="#f3ecdf" intensity={isHighQuality ? 0.42 : 1.15} />
      <hemisphereLight color="#f6efe3" groundColor="#2a2b2f" intensity={isHighQuality ? 0.5 : 0.95} />
      {positions.map((z) => (
        <group key={z} position={[0, CEILING_Y - 0.01, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 24]} />
            <meshStandardMaterial color="#fff6e8" emissive="#fff1dc" emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.4, 2.4]} />
            <meshBasicMaterial blending={THREE.AdditiveBlending} depthWrite={false} map={glow} opacity={0.35} transparent />
          </mesh>
          <pointLight color="#ffe9cf" decay={1.8} distance={isHighQuality ? 11 : 16} intensity={isHighQuality ? 7 : 11} position={[0, -0.3, 0]} />
        </group>
      ))}
      <spotLight angle={0.7} color="#fff0dc" decay={1.4} distance={16} intensity={isHighQuality ? 20 : 30} penumbra={0.8} position={[0, CEILING_Y - 0.4, -hallLength + ENTRANCE_Z + 5]} target={endWallTarget} />
      <primitive object={endWallTarget} />
    </>
  );
}

/** Low museum benches down the centre line every second row. */
function Benches({ rows }: { rows: number }) {
  const positions = useMemo(() => Array.from({ length: Math.max(1, Math.floor(rows / 2)) }, (_, index) => FIRST_ROW_Z - ROW_SPACING * (1 + index * 2)), [rows]);
  return (
    <>
      {positions.map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.46, 0]}>
            <boxGeometry args={[2.1, 0.09, 0.55]} />
            <meshStandardMaterial color="#5a4a3a" roughness={0.55} />
          </mesh>
          {[-0.85, 0.85].map((x) => (
            <mesh key={x} position={[x, 0.21, 0]}>
              <boxGeometry args={[0.08, 0.42, 0.46]} />
              <meshStandardMaterial color="#1d1c1a" metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function EndWall({ hallLength, map }: { hallLength: number; map: THREE.Texture | null }) {
  return (
    <group position={[0, CEILING_Y / 2, -hallLength + ENTRANCE_Z]}>
      <mesh>
        <boxGeometry args={[HALL_WIDTH, CEILING_Y, 0.24]} />
        <meshStandardMaterial color="#0b1a28" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.1, 0.13]}>
        <planeGeometry args={[11.2, 5.2]} />
        <meshStandardMaterial map={map ?? undefined} roughness={0.8} />
      </mesh>
      <mesh position={[0, -2.8, 0.13]}>
        <boxGeometry args={[11.2, 0.03, 0.05]} />
        <meshStandardMaterial color="#9484c4" emissive="#9484c4" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Entrance({ textures, landscape }: { textures: Textures; landscape: THREE.Texture | null }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 4.5, CEILING_Y / 2, ENTRANCE_Z]}>
          <boxGeometry args={[3, CEILING_Y, 0.24]} />
          <meshStandardMaterial map={(side === -1 ? textures.entranceLeft : textures.entranceRight) ?? undefined} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, CEILING_Y / 2, ENTRANCE_Z]}>
        <boxGeometry args={[6, CEILING_Y, 0.05]} />
        <meshStandardMaterial map={textures.glass ?? undefined} metalness={0.7} roughness={0.12} transparent />
      </mesh>
      {landscape && (
        <mesh position={[0, 2.9, 7.5]}>
          <planeGeometry args={[18, 9]} />
          <meshBasicMaterial depthWrite={false} map={landscape} />
        </mesh>
      )}
    </>
  );
}

function useLandscapeTexture() {
  const [landscape, setLandscape] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let isActive = true;
    new THREE.TextureLoader().load(
      `${BASE_PATH}/media/landscape.png`,
      (texture) => {
        if (!isActive) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        setLandscape(texture);
      },
      undefined,
      (error) => console.warn("입구 풍경 이미지를 불러오지 못했습니다.", error),
    );
    return () => {
      isActive = false;
    };
  }, []);
  return landscape;
}

type GalleryHallProps = Omit<GallerySceneProps, "isVideoPlaying"> & { isHighQuality: boolean };

function GalleryHall({ artworks, moveInput, onSelect, isHighQuality }: GalleryHallProps) {
  const hallLength = hallLengthFor(artworks.length);
  const rows = Math.ceil(artworks.length / 2);
  const textures = useTextures(hallLength);
  const landscape = useLandscapeTexture();

  return (
    <>
      <color args={[BACKGROUND]} attach="background" />
      <fog args={[BACKGROUND, 18, 64]} attach="fog" />
      {isHighQuality && (
        <Environment frames={1} resolution={64}>
          <Lightformer color="#fff1dc" intensity={1.6} position={[0, 5, -10]} rotation-x={Math.PI / 2} scale={[10, 40, 1]} />
          <Lightformer color="#d9d2c4" intensity={0.5} position={[-6, 3, -10]} rotation-y={Math.PI / 2} scale={[40, 6, 1]} />
          <Lightformer color="#d9d2c4" intensity={0.5} position={[6, 3, -10]} rotation-y={-Math.PI / 2} scale={[40, 6, 1]} />
        </Environment>
      )}

      <HallLights glow={textures.glow} hallLength={hallLength} isHighQuality={isHighQuality} rows={rows} />
      <Floor hallLength={hallLength} isHighQuality={isHighQuality} map={textures.floor} />
      <Walls hallLength={hallLength} map={textures.wall} />
      <EndWall hallLength={hallLength} map={textures.endWall} />
      <Entrance landscape={landscape} textures={textures} />
      <Benches rows={rows} />
      {artworks.map((artwork, index) => (
        <ArtworkPanel key={artwork.id} artwork={artwork} index={index} isHighQuality={isHighQuality && artworks.length <= MAX_SPOTLIT_ARTWORKS} onSelect={onSelect} />
      ))}
      <VisitorController hallLength={hallLength} moveInput={moveInput} />
    </>
  );
}

function detectHighQuality() {
  if (typeof window === "undefined") return true;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return !isCoarsePointer && cores > 4;
}

/** WebGL exhibition hall built from primitives and procedural textures only. */
export function GalleryScene({ artworks, moveInput, onSelect, isVideoPlaying = false }: GallerySceneProps) {
  const [isHighQuality] = useState(detectHighQuality);
  return (
    <Canvas
      camera={{ fov: 62, near: 0.1, far: 90, position: [0, 1.72, 0.6] }}
      dpr={isHighQuality ? [1, 1.75] : [1, 1.25]}
      frameloop={isVideoPlaying ? "never" : "always"}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ touchAction: "none" }}
    >
      <GalleryHall artworks={artworks} isHighQuality={isHighQuality} moveInput={moveInput} onSelect={onSelect} />
    </Canvas>
  );
}
