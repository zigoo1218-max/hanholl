"use client";

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { createPlaceholderTexture, createPlateTexture, createReservedPlateTexture, createReservedTexture, getSharedLightPoolTexture, getSharedShadowTexture } from "@/components/gallery/textures";
import { ACCENT_COLORS } from "@/data/accents";
import { captureVideoFrame } from "@/lib/video-utils";
import type { Room } from "@/data/rooms";
import type { ShowcaseVideo } from "@/types/showcase";

const PANEL_X = 5.84;
const FRAME_PADDING = 0.42;
/** Plate geometry: offset 0.6 + width 1.0 keeps the right edge at 2.75 m from a 3.3 m frame centre, inside the 2.85 m to the next frame. */
const PLATE_OFFSET = 0.6;
const PLATE_WIDTH = 1.0;
const CLICK_DRAG_TOLERANCE_PX = 6;

/** Image opening sizes: height is fixed per orientation, width follows the real aspect within limits. */
const LANDSCAPE = { height: 1.62, minWidth: 1.9, maxWidth: 2.88, centerY: 2.05 };
const PORTRAIT = { height: 2.46, minWidth: 1.1, maxWidth: 1.85, centerY: 2.15 };

/** Where a frame hangs: left (-1) or right (+1) wall, and its centre along the hall. */
type WallSpot = { side: -1 | 1; z: number };

type ArtworkPanelProps = WallSpot & {
  artwork: ShowcaseVideo;
  isHighQuality: boolean;
  onSelect: (artwork: ShowcaseVideo) => void;
};

type ReservedPanelProps = WallSpot & {
  room: Room;
  slotNumber: number;
};

type Opening = { width: number; height: number; centerY: number; isPortrait: boolean };

function openingForAspect(aspect: number): Opening {
  const isPortrait = aspect < 1;
  const spec = isPortrait ? PORTRAIT : LANDSCAPE;
  const width = THREE.MathUtils.clamp(aspect * spec.height, spec.minWidth, spec.maxWidth);
  return { width, height: spec.height, centerY: spec.centerY, isPortrait };
}

function defaultAspect(orientation: ShowcaseVideo["orientation"]) {
  return orientation === "portrait" ? 9 / 16 : 16 / 9;
}

/** Centre-crops the texture when the opening could not match the image aspect exactly. */
function cropTextureToOpening(texture: THREE.Texture, imageAspect: number, opening: Opening) {
  const openingAspect = opening.width / opening.height;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (imageAspect > openingAspect) {
    const repeatX = openingAspect / imageAspect;
    texture.repeat.set(repeatX, 1);
    texture.offset.set((1 - repeatX) / 2, 0);
    return;
  }
  const repeatY = imageAspect / openingAspect;
  texture.repeat.set(1, repeatY);
  texture.offset.set(0, (1 - repeatY) / 2);
}

function readImageAspect(texture: THREE.Texture) {
  const image = texture.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const width = image.naturalWidth || image.width || 0;
  const height = image.naturalHeight || image.height || 0;
  return width > 0 && height > 0 ? width / height : null;
}

/**
 * Loads the thumbnail; if it is missing, grabs a frame from the video instead.
 * Returns the texture and the real image aspect so the frame can be sized.
 */
function useArtworkTexture(artwork: ShowcaseVideo, maxAnisotropy: number) {
  const [state, setState] = useState<{ texture: THREE.Texture; aspect: number } | null>(null);

  useEffect(() => {
    let isActive = true;
    const loader = new THREE.TextureLoader();
    const apply = (texture: THREE.Texture) => {
      if (!isActive) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      const aspect = readImageAspect(texture) ?? defaultAspect(artwork.orientation);
      setState({ texture, aspect });
    };
    const loadFromVideo = () =>
      captureVideoFrame(artwork.videoUrl)
        .then((dataUrl) => loader.load(dataUrl, apply))
        .catch((error: unknown) => console.warn(`${artwork.id}: 썸네일과 영상 프레임을 모두 불러오지 못했습니다.`, error));

    if (artwork.thumbnailUrl) {
      loader.load(artwork.thumbnailUrl, apply, undefined, () => {
        if (isActive) void loadFromVideo();
      });
    } else {
      void loadFromVideo();
    }
    return () => {
      isActive = false;
    };
  }, [artwork.id, artwork.thumbnailUrl, artwork.videoUrl, artwork.orientation, maxAnisotropy]);

  useEffect(() => () => state?.texture.dispose(), [state]);
  return state;
}

type FramedPieceProps = WallSpot & {
  opening: Opening;
  image: THREE.Texture | null;
  plate: THREE.Texture | null;
  accent: string;
  /** Per-frame spotlight; off for reserved frames and large shows. */
  hasSpotlight: boolean;
  isHovered: boolean;
  /** Present only for real works: click + hover on frame and plate. */
  interaction?: {
    onClick: (event: ThreeEvent<MouseEvent>) => void;
    onHoverChange: (isHovered: boolean) => void;
  };
};

/**
 * Shared frame body: matte black frame with brass lip, cream mat, image,
 * accent LED strip, caption plate and picture light. Used by real works and
 * by reserved "작품 준비 중" frames so both read as the same exhibition.
 */
function FramedPiece({ side, z, opening, image, plate, accent, hasSpotlight, isHovered, interaction }: FramedPieceProps) {
  const shadow = getSharedShadowTexture();
  const lightPool = getSharedLightPoolTexture();
  const spotTarget = useMemo(() => new THREE.Object3D(), []);
  const frameWidth = opening.width + FRAME_PADDING;
  const frameHeight = opening.height + FRAME_PADDING;
  const lightWidth = Math.min(frameWidth - 0.4, 1.6);
  const pointerHandlers = interaction
    ? {
        onClick: interaction.onClick,
        onPointerOut: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          interaction.onHoverChange(false);
        },
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          interaction.onHoverChange(true);
        },
      }
    : {};

  return (
    <group position={[side * PANEL_X, opening.centerY, z]} rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}>
      {/* Warm light pool from the picture light, drawn on the wall behind the frame. */}
      <mesh position={[0, 0.35, 0.004]}>
        <planeGeometry args={[frameWidth + 2.2, frameHeight + 2.2]} />
        <meshBasicMaterial blending={THREE.AdditiveBlending} depthWrite={false} map={lightPool} opacity={hasSpotlight ? 0.55 : 0.8} transparent />
      </mesh>
      {/* Soft contact shadow so the frame reads as hanging on the wall. */}
      <mesh position={[0.06, -0.16, 0.006]}>
        <planeGeometry args={[frameWidth + 1, frameHeight + 0.9]} />
        <meshBasicMaterial depthWrite={false} map={shadow} opacity={0.7} transparent />
      </mesh>

      <group {...pointerHandlers}>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[frameWidth, frameHeight, 0.1]} />
          <meshStandardMaterial color="#1a1917" metalness={0.25} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[frameWidth - 0.18, frameHeight - 0.18, 0.012]} />
          <meshStandardMaterial color="#c2a46b" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.106]}>
          <planeGeometry args={[frameWidth - 0.24, frameHeight - 0.24]} />
          <meshStandardMaterial color="#f4efe6" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0, 0.112]}>
          <planeGeometry args={[opening.width, opening.height]} />
          <meshStandardMaterial map={image} roughness={0.6} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.116]}>
          <planeGeometry args={[frameWidth - 0.24, frameHeight - 0.24]} />
          <meshStandardMaterial color="#ffffff" metalness={0.9} opacity={isHovered ? 0.1 : 0.04} roughness={0.08} transparent />
        </mesh>
      </group>

      {/* Accent LED strip under the frame. */}
      <mesh position={[0, -frameHeight / 2 - 0.06, 0.06]}>
        <boxGeometry args={[frameWidth - 0.3, 0.03, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isHovered ? 3.2 : interaction ? 1.6 : 0.6} toneMapped={false} />
      </mesh>

      {/* Caption plate beside the frame. Its right edge stays inside the 1.2 m gap to the next frame (ROW_SPACING - max frame width). */}
      <group position={[frameWidth / 2 + PLATE_OFFSET, -frameHeight / 2 + 0.52, 0.02]} {...pointerHandlers}>
        <mesh>
          <boxGeometry args={[PLATE_WIDTH, PLATE_WIDTH / 2, 0.03]} />
          <meshStandardMaterial color="#e9e3d7" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <planeGeometry args={[PLATE_WIDTH - 0.04, PLATE_WIDTH / 2 - 0.02]} />
          <meshStandardMaterial map={plate} roughness={0.85} />
        </mesh>
      </group>

      {/* Picture light arm and head above the frame. */}
      <group position={[0, frameHeight / 2 + 0.48, 0.3]}>
        <mesh position={[0, 0.02, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.32, 10]} />
          <meshStandardMaterial color="#2b2b2d" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, lightWidth, 14]} />
          <meshStandardMaterial color="#2b2b2d" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.04, 0.01]}>
          <boxGeometry args={[lightWidth - 0.1, 0.012, 0.06]} />
          <meshStandardMaterial color="#fff1dc" emissive="#ffe6c4" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        {hasSpotlight && (
          <>
            <spotLight angle={0.62} color="#ffe9cf" decay={1.6} distance={6} intensity={9} penumbra={0.75} position={[0, -0.02, 0.02]} target={spotTarget} />
            <primitive object={spotTarget} position={[0, -frameHeight / 2 - 0.5, -0.32]} />
          </>
        )}
      </group>
    </group>
  );
}

/**
 * A student work. The frame is sized from the real thumbnail aspect, so
 * portrait phone videos hang as tall frames and widescreen videos as wide ones.
 */
export function ArtworkPanel({ artwork, side, z, isHighQuality, onSelect }: ArtworkPanelProps) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const accent = ACCENT_COLORS[artwork.accent];
  const [isHovered, setIsHovered] = useState(false);
  const loaded = useArtworkTexture(artwork, maxAnisotropy);

  const opening = useMemo(() => openingForAspect(loaded?.aspect ?? defaultAspect(artwork.orientation)), [loaded, artwork.orientation]);
  useEffect(() => {
    if (loaded) cropTextureToOpening(loaded.texture, loaded.aspect, opening);
  }, [loaded, opening]);

  const placeholder = useMemo(() => createPlaceholderTexture(accent, artwork.teamLabel, opening.isPortrait), [accent, artwork.teamLabel, opening.isPortrait]);
  const plate = useMemo(() => createPlateTexture(artwork), [artwork]);
  useEffect(() => () => placeholder?.dispose(), [placeholder]);
  useEffect(() => () => plate?.dispose(), [plate]);

  useEffect(() => {
    document.body.style.cursor = isHovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [isHovered]);

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > CLICK_DRAG_TOLERANCE_PX) return;
    onSelect(artwork);
  };

  return (
    <FramedPiece
      accent={accent}
      hasSpotlight={isHighQuality}
      image={loaded?.texture ?? placeholder}
      interaction={{ onClick: handleSelect, onHoverChange: setIsHovered }}
      isHovered={isHovered}
      opening={opening}
      plate={plate}
      side={side}
      z={z}
    />
  );
}

/** Empty frame held for a future work ("작품 준비 중"); not clickable and never spotlit. */
export function ReservedPanel({ room, slotNumber, side, z }: ReservedPanelProps) {
  const opening = useMemo(() => openingForAspect(16 / 9), []);
  const image = useMemo(() => createReservedTexture(room), [room]);
  const plate = useMemo(() => createReservedPlateTexture(room, slotNumber), [room, slotNumber]);
  useEffect(() => () => image?.dispose(), [image]);
  useEffect(() => () => plate?.dispose(), [plate]);
  return <FramedPiece accent={room.accent} hasSpotlight={false} image={image} isHovered={false} opening={opening} plate={plate} side={side} z={z} />;
}
