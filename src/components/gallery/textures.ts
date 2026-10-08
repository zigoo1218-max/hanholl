import * as THREE from "three";
import { ACCENT_COLORS, ACCENT_LABELS } from "@/data/accents";
import type { Room } from "@/data/rooms";
import type { ShowcaseVideo } from "@/types/showcase";

/**
 * All exhibition surfaces are procedural canvas textures so the gallery runs
 * offline on the event laptop without any image server.
 */

export { ACCENT_COLORS } from "@/data/accents";

export type CanvasTextureResult = THREE.CanvasTexture | null;

const FONT_STACK = '"Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    console.warn(`2D 캔버스를 만들지 못해 ${width}×${height} 텍스처 없이 렌더링합니다.`);
    return null;
  }
  return { canvas, context };
}

function toTexture(canvas: HTMLCanvasElement, repeat?: [number, number]) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

/** Deterministic pseudo random so textures look identical on every load. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function sprinkleNoise(context: CanvasRenderingContext2D, size: number, count: number, color: string, seed: number) {
  const random = seededRandom(seed);
  context.fillStyle = color;
  for (let index = 0; index < count; index += 1) {
    const radius = 0.6 + random() * 1.6;
    context.beginPath();
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
    context.fill();
  }
}

/** Warm plaster wall with very fine grain. */
export function createWallTexture(repeatX: number, repeatY: number): CanvasTextureResult {
  const made = createCanvas(512, 512);
  if (!made) return null;
  const { canvas, context } = made;
  context.fillStyle = "#ebe5d9";
  context.fillRect(0, 0, 512, 512);
  sprinkleNoise(context, 512, 1800, "rgba(255, 255, 255, 0.22)", 11);
  sprinkleNoise(context, 512, 1400, "rgba(150, 138, 118, 0.14)", 29);
  return toTexture(canvas, [repeatX, repeatY]);
}

/** Dark polished stone floor with large tiles and light grout. */
export function createFloorTexture(repeatX: number, repeatY: number): CanvasTextureResult {
  const made = createCanvas(512, 512);
  if (!made) return null;
  const { canvas, context } = made;
  context.fillStyle = "#2c2f35";
  context.fillRect(0, 0, 512, 512);
  sprinkleNoise(context, 512, 2600, "rgba(255, 255, 255, 0.05)", 7);
  sprinkleNoise(context, 512, 1800, "rgba(0, 0, 0, 0.18)", 13);
  context.strokeStyle = "rgba(160, 158, 150, 0.35)";
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, 509, 509);
  context.strokeStyle = "rgba(0, 0, 0, 0.35)";
  context.lineWidth = 2;
  context.strokeRect(5, 5, 502, 502);
  return toTexture(canvas, [repeatX, repeatY]);
}

/** Soft radial fade used for fake contact shadows and light pools. */
export function createRadialTexture(inner: string, outer: string): CanvasTextureResult {
  const made = createCanvas(256, 256);
  if (!made) return null;
  const { canvas, context } = made;
  const gradient = context.createRadialGradient(128, 128, 10, 128, 128, 128);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let sharedShadow: CanvasTextureResult | undefined;
let sharedLightPool: CanvasTextureResult | undefined;

/** One contact-shadow texture shared by every frame. */
export function getSharedShadowTexture(): CanvasTextureResult {
  if (sharedShadow === undefined) sharedShadow = createRadialTexture("rgba(0, 0, 0, 0.55)", "rgba(0, 0, 0, 0)");
  return sharedShadow;
}

/** One warm light-pool texture shared by every picture light. */
export function getSharedLightPoolTexture(): CanvasTextureResult {
  if (sharedLightPool === undefined) sharedLightPool = createRadialTexture("rgba(255, 238, 214, 0.5)", "rgba(255, 238, 214, 0)");
  return sharedLightPool;
}

/** Gradient card shown inside a frame while no thumbnail is available. */
export function createPlaceholderTexture(accent: string, teamLabel: string, isPortrait: boolean): CanvasTextureResult {
  const width = isPortrait ? 576 : 1024;
  const height = isPortrait ? 1024 : 576;
  const made = createCanvas(width, height);
  if (!made) return null;
  const { canvas, context } = made;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#15202b");
  gradient.addColorStop(1, "#0a1119");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = accent;
  context.globalAlpha = 0.28;
  context.beginPath();
  context.arc(width * 0.84, height * 0.2, Math.min(width, height) * 0.55, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const centerX = width / 2;
  const centerY = height / 2 - 20;
  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(centerX, centerY, 74, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(centerX - 20, centerY - 38);
  context.lineTo(centerX + 36, centerY);
  context.lineTo(centerX - 20, centerY + 38);
  context.closePath();
  context.fill();

  context.textAlign = "center";
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.font = `600 30px ${FONT_STACK}`;
  context.fillText(`${teamLabel} 작품 영상`, centerX, centerY + 140);
  context.fillStyle = "rgba(255, 255, 255, 0.4)";
  context.font = `500 20px ${FONT_STACK}`;
  context.fillText("작품을 선택하면 영상을 재생합니다", centerX, centerY + 178);
  return toTexture(canvas);
}

function wrapByCharacter(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let current = "";
  for (const character of text) {
    const candidate = current + character;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  return [...kept.slice(0, -1), `${kept[kept.length - 1].slice(0, -1)}…`];
}

/** Museum-style caption plate mounted beside each frame. */
export function createPlateTexture(artwork: ShowcaseVideo): CanvasTextureResult {
  const made = createCanvas(640, 320);
  if (!made) return null;
  const { canvas, context } = made;
  const accent = ACCENT_COLORS[artwork.accent];

  context.fillStyle = "#f7f3ea";
  context.fillRect(0, 0, 640, 320);
  context.fillStyle = accent;
  context.fillRect(0, 0, 14, 320);
  context.strokeStyle = "rgba(20, 28, 36, 0.12)";
  context.lineWidth = 2;
  context.strokeRect(1, 1, 638, 318);

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = accent;
  context.font = `800 26px ${FONT_STACK}`;
  const team = artwork.teamLabel.toUpperCase();
  context.fillText(team, 48, 68);

  context.fillStyle = "rgba(20, 28, 36, 0.45)";
  context.font = `600 18px ${FONT_STACK}`;
  context.fillText(ACCENT_LABELS[artwork.accent], 48 + context.measureText(team).width + 36, 68);

  context.fillStyle = "#111b26";
  context.font = `700 38px ${FONT_STACK}`;
  wrapByCharacter(context, artwork.title, 540, 2).forEach((line, index) => context.fillText(line, 48, 120 + index * 46));

  // Student names get two lines so a full team list is not cut to one.
  context.fillStyle = "#56646f";
  context.font = `500 22px ${FONT_STACK}`;
  wrapByCharacter(context, artwork.studentNames.join(" · "), 540, 2).forEach((line, index) => context.fillText(line, 48, 230 + index * 30));

  context.fillStyle = "rgba(20, 28, 36, 0.3)";
  context.font = `600 16px ${FONT_STACK}`;
  context.textAlign = "right";
  context.fillText("VIDEO · 2026", 600, 296);
  return toTexture(canvas);
}

/** Large title wall that closes the far end of the hall. */
export function createEndWallTexture(): CanvasTextureResult {
  const made = createCanvas(2048, 1024);
  if (!made) return null;
  const { canvas, context } = made;

  const gradient = context.createLinearGradient(0, 0, 2048, 1024);
  gradient.addColorStop(0, "#0f2c42");
  gradient.addColorStop(0.55, "#0a1c2c");
  gradient.addColorStop(1, "#06121e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2048, 1024);

  const pine = context.createRadialGradient(1700, 180, 20, 1700, 180, 620);
  pine.addColorStop(0, "rgba(77, 144, 121, 0.75)");
  pine.addColorStop(1, "rgba(77, 144, 121, 0)");
  context.fillStyle = pine;
  context.fillRect(0, 0, 2048, 1024);

  const hydrangea = context.createRadialGradient(260, 980, 20, 260, 980, 640);
  hydrangea.addColorStop(0, "rgba(148, 132, 196, 0.7)");
  hydrangea.addColorStop(1, "rgba(148, 132, 196, 0)");
  context.fillStyle = hydrangea;
  context.fillRect(0, 0, 2048, 1024);

  context.strokeStyle = "rgba(255, 255, 255, 0.06)";
  context.lineWidth = 1;
  for (let x = 0; x <= 2048; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 1024);
    context.stroke();
  }
  for (let y = 0; y <= 1024; y += 128) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(2048, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(251, 250, 247, 0.35)";
  context.lineWidth = 3;
  context.strokeRect(160, 120, 1728, 784);

  context.textAlign = "center";
  context.fillStyle = "rgba(216, 227, 226, 0.75)";
  context.font = `600 34px ${FONT_STACK}`;
  context.fillText("H A N H O L L   V I D E O   E X H I B I T I O N   2 0 2 6", 1024, 300);

  context.fillStyle = "#fbfaf7";
  context.font = `800 118px ${FONT_STACK}`;
  context.fillText("한홀중학교 학생 영상 작품전", 1024, 520);

  context.fillStyle = "rgba(251, 250, 247, 0.6)";
  context.fillRect(904, 580, 240, 3);

  context.fillStyle = "#d8e3e2";
  context.font = `600 44px ${FONT_STACK}`;
  context.fillText("서로를 밝히며 함께 성장하는 한홀", 1024, 680);
  context.fillStyle = "rgba(216, 227, 226, 0.7)";
  context.font = `500 30px ${FONT_STACK}`;
  context.fillText("존중 · 협력 · 성장", 1024, 760);
  return toTexture(canvas);
}

/** Entrance side walls: school identity in the same warm plaster finish. */
export function createEntranceSideWallTexture(side: "left" | "right"): CanvasTextureResult {
  const made = createCanvas(512, 1024);
  if (!made) return null;
  const { canvas, context } = made;
  context.fillStyle = "#ebe5d9";
  context.fillRect(0, 0, 512, 1024);
  sprinkleNoise(context, 512, 900, "rgba(255, 255, 255, 0.2)", 41);
  context.fillStyle = "#1d1c1a";
  context.fillRect(0, 984, 512, 40);

  context.textAlign = "center";
  if (side === "left") {
    context.fillStyle = "#4d9079";
    context.fillRect(226, 380, 60, 4);
    context.fillStyle = "#13202c";
    context.font = `800 52px ${FONT_STACK}`;
    context.fillText("한홀중학교", 256, 470);
    context.fillStyle = "#56646f";
    context.font = `500 26px ${FONT_STACK}`;
    context.fillText("학생 영상 성과발표회", 256, 525);
    return toTexture(canvas);
  }
  context.fillStyle = "#9484c4";
  context.fillRect(226, 360, 60, 4);
  context.fillStyle = "#13202c";
  context.font = `800 40px ${FONT_STACK}`;
  context.fillText("서로를 밝히며", 256, 440);
  context.fillText("함께 성장하는 한홀", 256, 496);
  context.fillStyle = "#3a6857";
  context.font = `italic 500 26px ${FONT_STACK}`;
  context.fillText("존중 · 협력 · 성장", 256, 560);
  return toTexture(canvas);
}

/** Transparent glass entrance door with slim dark frame and exit sign. */
export function createGlassDoorTexture(): CanvasTextureResult {
  const made = createCanvas(512, 512);
  if (!made) return null;
  const { canvas, context } = made;
  context.clearRect(0, 0, 512, 512);

  context.strokeStyle = "rgba(255, 255, 255, 0.28)";
  context.lineWidth = 12;
  context.beginPath();
  context.moveTo(90, 0);
  context.lineTo(0, 90);
  context.moveTo(300, 0);
  context.lineTo(0, 300);
  context.moveTo(512, 120);
  context.lineTo(120, 512);
  context.stroke();

  context.strokeStyle = "#2a2a2c";
  context.lineWidth = 12;
  context.strokeRect(0, 0, 512, 512);
  context.beginPath();
  context.moveTo(256, 0);
  context.lineTo(256, 512);
  context.moveTo(0, 76);
  context.lineTo(512, 76);
  context.stroke();

  context.fillStyle = "#c9c3b4";
  context.fillRect(238, 200, 10, 160);
  context.fillRect(264, 200, 10, 160);

  context.fillStyle = "#2eb35a";
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(226, 18, 60, 34, 4);
  } else {
    context.rect(226, 18, 60, 34);
  }
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = `700 14px ${FONT_STACK}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("EXIT", 256, 35);
  return toTexture(canvas);
}

const reservedImageCache = new Map<string, CanvasTextureResult>();

/** One "작품 준비 중" image per room, shared by all its empty frames (10 frames would otherwise hold 10 identical canvases). */
export function getSharedReservedTexture(room: Room): CanvasTextureResult {
  if (!reservedImageCache.has(room.id)) reservedImageCache.set(room.id, createReservedTexture(room));
  return reservedImageCache.get(room.id) ?? null;
}

/** Image for an empty frame held for a future work. */
function createReservedTexture(room: Room): CanvasTextureResult {
  const made = createCanvas(1024, 576);
  if (!made) return null;
  const { canvas, context } = made;
  const gradient = context.createLinearGradient(0, 0, 1024, 576);
  gradient.addColorStop(0, "#1a1d24");
  gradient.addColorStop(1, "#0d0f13");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 576);

  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 2;
  context.setLineDash([10, 12]);
  context.strokeRect(70, 60, 884, 456);
  context.setLineDash([]);

  context.textAlign = "center";
  context.fillStyle = room.accent;
  context.font = `800 30px ${FONT_STACK}`;
  context.fillText(`${room.name} · ${room.subtitle}`, 512, 240);
  context.fillStyle = "rgba(244, 239, 230, 0.86)";
  context.font = `700 56px ${FONT_STACK}`;
  context.fillText("작품 준비 중", 512, 318);
  context.fillStyle = "rgba(244, 239, 230, 0.45)";
  context.font = `500 24px ${FONT_STACK}`;
  context.fillText("곧 이 자리에 학생 영상이 전시됩니다", 512, 372);
  return toTexture(canvas);
}

/** Caption plate for an empty frame. */
export function createReservedPlateTexture(room: Room, slotNumber: number): CanvasTextureResult {
  const made = createCanvas(640, 320);
  if (!made) return null;
  const { canvas, context } = made;
  context.fillStyle = "#f2eee6";
  context.fillRect(0, 0, 640, 320);
  context.fillStyle = room.accent;
  context.fillRect(0, 0, 14, 320);
  context.textAlign = "left";
  context.fillStyle = room.accent;
  context.font = `800 26px ${FONT_STACK}`;
  context.fillText(`${room.name} · ${String(slotNumber).padStart(2, "0")}`, 48, 76);
  context.fillStyle = "#3b4650";
  context.font = `700 38px ${FONT_STACK}`;
  context.fillText("작품 준비 중", 48, 150);
  context.fillStyle = "#7a858e";
  context.font = `500 22px ${FONT_STACK}`;
  context.fillText(room.subtitle, 48, 200);
  return toTexture(canvas);
}

/**
 * Sign above a doorway. `heading` says where the visitor is going, e.g.
 * "B실 · 1학기 작품 →" on the A실 side.
 */
export function createRoomSignTexture(room: Room, hint: string): CanvasTextureResult {
  const made = createCanvas(1024, 256);
  if (!made) return null;
  const { canvas, context } = made;
  context.fillStyle = "#101318";
  context.fillRect(0, 0, 1024, 256);
  context.fillStyle = room.accent;
  context.fillRect(0, 244, 1024, 12);
  context.textAlign = "center";
  context.fillStyle = "#f4efe6";
  context.font = `800 92px ${FONT_STACK}`;
  context.fillText(room.name, 512, 128);
  context.fillStyle = "rgba(244, 239, 230, 0.7)";
  context.font = `600 34px ${FONT_STACK}`;
  context.fillText(`${room.subtitle} · ${hint}`, 512, 192);
  return toTexture(canvas);
}

