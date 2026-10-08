"use client";

import { Environment, Lightformer, MeshReflectorMaterial, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { ArtworkPanel, ReservedPanel } from "@/components/gallery/artwork-panel";
import { DOOR_HEIGHT, DOOR_WIDTH, ENTRANCE_Z, PARTITION_THICKNESS, ROW_SPACING, type HallLayout, type RoomLayout } from "@/components/gallery/layout";
import { createEndWallTexture, createEntranceSideWallTexture, createFloorTexture, createGlassDoorTexture, createRadialTexture, createRoomSignTexture, createWallTexture } from "@/components/gallery/textures";
import { VisitorController } from "@/components/gallery/visitor-controller";
import type { MoveInput } from "@/components/gallery-controls";
import type { ShowcaseVideo } from "@/types/showcase";

type GallerySceneProps = {
  layout: HallLayout;
  moveInput: RefObject<MoveInput>;
  /** Returns a pending room-jump index once (then null); read by the camera every frame. */
  takeJumpRequest: () => number | null;
  onRoomChange: (roomIndex: number) => void;
  onSelect: (artwork: ShowcaseVideo) => void;
  /** 0-100 share of scene images loaded, for the loading cover. */
  onLoadProgress: (percent: number) => void;
  /** Called once when the hall has been drawn with nothing left loading. */
  onReady: () => void;
  isVideoPlaying?: boolean;
};

/** Frames to draw after loading settles before calling the hall ready (covers shader compilation). */
const READY_FRAMES = 4;

/**
 * Reports image-loading progress and fires `onReady` once nothing is loading
 * and a few frames have rendered. Textures register with three's default
 * loading manager inside their mount effects, so loading is already "active"
 * by the first frame and the cover cannot lift before images start.
 */
function LoadingReporter({ onLoadProgress, onReady }: Pick<GallerySceneProps, "onLoadProgress" | "onReady">) {
  const isLoading = useProgress((state) => state.active);
  const progress = useProgress((state) => state.progress);
  const settledFrames = useRef(0);
  const hasReported = useRef(false);

  useEffect(() => {
    onLoadProgress(isLoading ? progress : 100);
  }, [isLoading, progress, onLoadProgress]);

  useFrame(() => {
    if (hasReported.current) return;
    settledFrames.current = isLoading ? 0 : settledFrames.current + 1;
    if (settledFrames.current < READY_FRAMES) return;
    hasReported.current = true;
    onReady();
  });
  return null;
}

const HALL_WIDTH = 12;
const WALL_X = HALL_WIDTH / 2;
const CEILING_Y = 5.75;
const BACKGROUND = "#0f1114";
const WALL_COLOR = "#e6dfd2";
const TRACK_X = 4.2;
/** Above this many works, per-frame spotlights are dropped (light pools remain) to keep the light count sane on laptop GPUs. */
const MAX_SPOTLIT_ARTWORKS = 12;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
function HallLights({ layout, glow, isHighQuality }: { layout: HallLayout; glow: THREE.Texture | null; isHighQuality: boolean }) {
  const positions = useMemo(
    () => layout.rooms.flatMap((room) => Array.from({ length: room.rows + 1 }, (_, index) => room.firstRowZ + ROW_SPACING / 2 - index * ROW_SPACING)),
    [layout],
  );
  const endWallTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 2.6, layout.endZ);
    return target;
  }, [layout.endZ]);
  return (
    <>
      <ambientLight color="#f3ecdf" intensity={isHighQuality ? 0.42 : 1.15} />
      <hemisphereLight color="#f6efe3" groundColor="#2a2b2f" intensity={isHighQuality ? 0.5 : 0.95} />
      {positions.map((z, index) => (
        <group key={z} position={[0, CEILING_Y - 0.01, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 24]} />
            <meshStandardMaterial color="#fff6e8" emissive="#fff1dc" emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.4, 2.4]} />
            <meshBasicMaterial blending={THREE.AdditiveBlending} depthWrite={false} map={glow} opacity={0.35} transparent />
          </mesh>
          {/* Real light on every second downlight only: two rooms would otherwise double the per-pixel light count on laptop GPUs. */}
          {index % 2 === 0 && <pointLight color="#ffe9cf" decay={1.8} distance={isHighQuality ? 14 : 18} intensity={isHighQuality ? 9 : 13} position={[0, -0.3, 0]} />}
        </group>
      ))}
      <spotLight angle={0.7} color="#fff0dc" decay={1.4} distance={16} intensity={isHighQuality ? 20 : 30} penumbra={0.8} position={[0, CEILING_Y - 0.4, layout.endZ + 5]} target={endWallTarget} />
      <primitive object={endWallTarget} />
    </>
  );
}

/** Low museum benches down the centre line every second row. */
function Benches({ rooms }: { rooms: RoomLayout[] }) {
  const positions = useMemo(
    () => rooms.flatMap((room) => Array.from({ length: Math.max(1, Math.floor(room.rows / 2)) }, (_, index) => room.firstRowZ - ROW_SPACING * (1 + index * 2))),
    [rooms],
  );
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

function EndWall({ z, map }: { z: number; map: THREE.Texture | null }) {
  return (
    <group position={[0, CEILING_Y / 2, z]}>
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

const SIDE_SEGMENT_WIDTH = (HALL_WIDTH - DOOR_WIDTH) / 2;
const LINTEL_HEIGHT = CEILING_Y - DOOR_HEIGHT;
const SIGN_SIZE: [number, number] = [3.4, 0.85];

/** Doorway sign that shows the room on the other side of the wall. */
function DoorSign({ room, hint, facing }: { room: RoomLayout["room"]; hint: string; facing: 1 | -1 }) {
  const texture = useMemo(() => createRoomSignTexture(room, hint), [room, hint]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <mesh position={[0, DOOR_HEIGHT + 0.75, facing * (PARTITION_THICKNESS / 2 + 0.01)]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
      <planeGeometry args={SIGN_SIZE} />
      <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.18} emissiveMap={texture} map={texture} roughness={0.6} />
    </mesh>
  );
}

/** Wall between two rooms with a central doorway; each face is signed with the room behind it. */
function Partition({ z, before, after, map }: { z: number; before: RoomLayout; after: RoomLayout; map: THREE.Texture | null }) {
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (DOOR_WIDTH / 2 + SIDE_SEGMENT_WIDTH / 2), CEILING_Y / 2, 0]}>
          <boxGeometry args={[SIDE_SEGMENT_WIDTH, CEILING_Y, PARTITION_THICKNESS]} />
          <meshStandardMaterial color={WALL_COLOR} map={map ?? undefined} roughness={0.96} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_HEIGHT + LINTEL_HEIGHT / 2, 0]}>
        <boxGeometry args={[DOOR_WIDTH, LINTEL_HEIGHT, PARTITION_THICKNESS]} />
        <meshStandardMaterial color="#1a1c21" roughness={0.8} />
      </mesh>
      {/* Dark door casing with an accent line, so the opening reads from far down the hall. */}
      {[-1, 1].map((side) => (
        <mesh key={`post-${side}`} position={[side * (DOOR_WIDTH / 2 + 0.06), DOOR_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.12, DOOR_HEIGHT, PARTITION_THICKNESS + 0.06]} />
          <meshStandardMaterial color="#1a1917" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_HEIGHT + 0.02, 0]}>
        <boxGeometry args={[DOOR_WIDTH + 0.24, 0.04, PARTITION_THICKNESS + 0.08]} />
        <meshStandardMaterial color={after.room.accent} emissive={after.room.accent} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <DoorSign facing={1} hint="이 문으로 입장" room={after.room} />
      <DoorSign facing={-1} hint="돌아가기" room={before.room} />
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

function GalleryHall({ layout, moveInput, takeJumpRequest, onRoomChange, onSelect, onLoadProgress, onReady, isHighQuality }: GalleryHallProps) {
  const { hallLength, rooms } = layout;
  const hasSpotlights = isHighQuality && layout.artworkCount <= MAX_SPOTLIT_ARTWORKS;
  const textures = useTextures(hallLength);
  const landscape = useLandscapeTexture();

  return (
    <>
      <color args={[BACKGROUND]} attach="background" />
      <fog args={[BACKGROUND, 18, 64]} attach="fog" />
      {isHighQuality && (
        <Environment frames={1} resolution={64}>
          <Lightformer color="#fff1dc" intensity={1.6} position={[0, 5, ENTRANCE_Z - hallLength / 2]} rotation-x={Math.PI / 2} scale={[10, hallLength, 1]} />
          <Lightformer color="#d9d2c4" intensity={0.5} position={[-6, 3, ENTRANCE_Z - hallLength / 2]} rotation-y={Math.PI / 2} scale={[hallLength, 6, 1]} />
          <Lightformer color="#d9d2c4" intensity={0.5} position={[6, 3, ENTRANCE_Z - hallLength / 2]} rotation-y={-Math.PI / 2} scale={[hallLength, 6, 1]} />
        </Environment>
      )}

      <HallLights glow={textures.glow} isHighQuality={isHighQuality} layout={layout} />
      <Floor hallLength={hallLength} isHighQuality={isHighQuality} map={textures.floor} />
      <Walls hallLength={hallLength} map={textures.wall} />
      <EndWall map={textures.endWall} z={layout.endZ} />
      {layout.partitions.map((z, index) => (
        <Partition key={z} after={rooms[index + 1]} before={rooms[index]} map={textures.wall} z={z} />
      ))}
      <Entrance landscape={landscape} textures={textures} />
      <Benches rooms={rooms} />
      {rooms.flatMap((roomLayout) =>
        roomLayout.slots.map((slot) =>
          slot.artwork ? (
            <ArtworkPanel key={slot.key} artwork={slot.artwork} isHighQuality={hasSpotlights} side={slot.side} z={slot.z} onSelect={onSelect} />
          ) : (
            <ReservedPanel key={slot.key} room={roomLayout.room} side={slot.side} slotNumber={slot.slotNumber} z={slot.z} />
          ),
        ),
      )}
      <LoadingReporter onLoadProgress={onLoadProgress} onReady={onReady} />
      <VisitorController layout={layout} moveInput={moveInput} takeJumpRequest={takeJumpRequest} onRoomChange={onRoomChange} />
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
export function GalleryScene({ layout, moveInput, takeJumpRequest, onRoomChange, onSelect, onLoadProgress, onReady, isVideoPlaying = false }: GallerySceneProps) {
  const [isHighQuality] = useState(detectHighQuality);
  return (
    <Canvas
      camera={{ fov: 62, near: 0.1, far: 90, position: [0, 1.72, layout.rooms[0]?.spawnZ ?? 0.6] }}
      dpr={isHighQuality ? [1, 1.75] : [1, 1.25]}
      frameloop={isVideoPlaying ? "never" : "always"}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ touchAction: "none" }}
    >
      <GalleryHall isHighQuality={isHighQuality} layout={layout} moveInput={moveInput} takeJumpRequest={takeJumpRequest} onLoadProgress={onLoadProgress} onReady={onReady} onRoomChange={onRoomChange} onSelect={onSelect} />
    </Canvas>
  );
}
