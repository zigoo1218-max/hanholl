const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  console.log("ffmpeg-static is not installed. Skipping thumbnail generation.");
  process.exit(0);
}

// Support ESM/CJS path resolution
const mediaDir = path.join(process.cwd(), 'public/media');

if (!fs.existsSync(mediaDir)) {
  console.log("Media directory not found at " + mediaDir);
  process.exit(0);
}

const dirs = fs.readdirSync(mediaDir);
console.log("Checking and generating thumbnails for videos...");

for (const dirName of dirs) {
  const dirPath = path.join(mediaDir, dirName);
  if (!fs.statSync(dirPath).isDirectory()) continue;

  // Search for any file named video.* (mp4, mov, webm)
  const files = fs.readdirSync(dirPath);
  const videoFile = files.find(f => /^video\.(mp4|mov|webm|MP4|MOV|WEBM)$/.test(f));
  if (!videoFile) continue;

  const videoPath = path.join(dirPath, videoFile);
  const thumbnailPath = path.join(dirPath, 'thumbnail.jpg');



  console.log(`Generating thumbnail for ${dirName} (${videoFile})...`);
  try {
    // Extract a frame at 1.5s
    const cmd = `"${ffmpegPath}" -y -i "${videoPath}" -ss 00:00:01.500 -vframes 1 "${thumbnailPath}"`;
    execSync(cmd, { stdio: 'ignore' });
    console.log(`✓ Generated thumbnail for ${dirName}`);
  } catch (err) {
    console.error(`✗ Failed to generate thumbnail for ${dirName}:`, err.message);
  }
}
console.log("Thumbnail generation check complete.");
process.exit(0);
