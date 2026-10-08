/* eslint-disable @typescript-eslint/no-require-imports -- plain Node CommonJS build script */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

/**
 * Regenerates `thumbnail.jpg` next to every `video.*` under public/media on
 * each dev/build/start, so a replaced video always gets a matching poster.
 *
 * A fixed timestamp is not safe: many student videos open on a black fade-in
 * (1조 was 17/255 brightness at 1.5 s). Instead several points across the
 * video are measured and the first one with normal exposure wins.
 */

let ffmpegPath;
try {
  ffmpegPath = require("ffmpeg-static");
} catch {
  console.log("ffmpeg-static is not installed. Skipping thumbnail generation.");
  process.exit(0);
}
if (!ffmpegPath) {
  // ffmpeg-static exports null on platforms it has no binary for; keep existing thumbnails.
  console.log("ffmpeg-static has no binary for this platform. Skipping thumbnail generation.");
  process.exit(0);
}

/** Candidate positions as a fraction of the video length, tried in order. */
const CANDIDATE_FRACTIONS = [0.15, 0.25, 0.35, 0.5, 0.65];
/** Average luma (0-255) range that reads as a normally exposed frame. */
const MIN_LUMA = 45;
const MAX_LUMA = 215;
const FALLBACK_SECONDS = 1.5;
/** Used when the container reports no duration (e.g. some screen-recorded webm). */
const ABSOLUTE_CANDIDATES = [1, 2, 4, 8];

function readDurationSeconds(videoPath) {
  const probe = spawnSync(ffmpegPath, ["-hide_banner", "-i", videoPath], { encoding: "utf8" });
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probe.stderr || "");
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function measureLuma(videoPath, seconds) {
  const result = spawnSync(
    ffmpegPath,
    [
      "-hide_banner", "-loglevel", "error", "-ss", String(seconds), "-i", videoPath,
      "-frames:v", "1", "-vf", "scale=160:-1,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
      "-f", "null", "-",
    ],
    { encoding: "utf8" },
  );
  const match = /YAVG=([\d.]+)/.exec(result.stdout || "");
  return match ? Number(match[1]) : null;
}

/** Picks the first well-exposed candidate; otherwise the brightest one that is not blown out. */
function pickTimestamp(videoPath) {
  const duration = readDurationSeconds(videoPath);
  const candidates = duration
    ? CANDIDATE_FRACTIONS.map((fraction) => Number((duration * fraction).toFixed(2)))
    : ABSOLUTE_CANDIDATES;

  const measured = [];
  for (const seconds of candidates) {
    const luma = measureLuma(videoPath, seconds);
    if (luma === null) continue;
    if (luma >= MIN_LUMA && luma <= MAX_LUMA) return { seconds, luma, reason: "well exposed" };
    measured.push({ seconds, luma });
  }
  // Prefer the brightest frame that is not blown out; if every frame is blown out, take the least white one.
  const usable = measured.filter((item) => item.luma <= MAX_LUMA);
  const best = usable.length ? usable.sort((a, b) => b.luma - a.luma)[0] : measured.sort((a, b) => a.luma - b.luma)[0];
  return best ? { ...best, reason: "best available" } : { seconds: FALLBACK_SECONDS, luma: null, reason: "measurement failed" };
}

const mediaDir = path.join(process.cwd(), "public/media");
if (!fs.existsSync(mediaDir)) {
  console.log("Media directory not found at " + mediaDir);
  process.exit(0);
}

/** Collects every folder (any depth) that contains a video.* file, e.g. media/team1 or media/room-a/team1. */
function findVideoFolders(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const here = entries.find((entry) => entry.isFile() && /^video\.(mp4|mov|webm)$/i.test(entry.name));
  const nested = entries.filter((entry) => entry.isDirectory()).flatMap((entry) => findVideoFolders(path.join(dir, entry.name)));
  return here ? [{ dir, videoFile: here.name }, ...nested] : nested;
}

console.log("Checking and generating thumbnails for videos...");
let failures = 0;
for (const { dir, videoFile } of findVideoFolders(mediaDir)) {
  const label = path.relative(mediaDir, dir);
  const videoPath = path.join(dir, videoFile);
  const thumbnailPath = path.join(dir, "thumbnail.jpg");
  try {
    const { seconds, luma, reason } = pickTimestamp(videoPath);
    const before = fs.existsSync(thumbnailPath) ? fs.statSync(thumbnailPath).mtimeMs : 0;
    execFileSync(ffmpegPath, ["-y", "-loglevel", "error", "-ss", String(seconds), "-i", videoPath, "-frames:v", "1", "-q:v", "3", thumbnailPath], { stdio: "ignore" });
    // ffmpeg exits 0 without writing when the timestamp is past the end of a very short clip.
    if (!fs.existsSync(thumbnailPath) || fs.statSync(thumbnailPath).mtimeMs === before) {
      throw new Error(`no frame written at ${seconds}s`);
    }
    console.log(`✓ ${label}: ${seconds}s (luma ${luma === null ? "?" : luma.toFixed(0)}, ${reason})`);
  } catch (err) {
    failures += 1;
    console.error(`✗ Failed to generate thumbnail for ${label}:`, err.message);
  }
}
console.log(`Thumbnail generation check complete.${failures ? ` ${failures} failed — those folders keep their previous thumbnail.` : ""}`);
process.exit(0);
