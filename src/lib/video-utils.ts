/**
 * Captures the first meaningful frame from a video URL via Canvas API.
 * Returns a data URL (JPEG) of the captured frame.
 */
export function captureVideoFrame(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    // Apply crossOrigin only if videoUrl is absolute and points to a different origin
    if (typeof window !== "undefined") {
      const isAbsolute = videoUrl.startsWith("http://") || videoUrl.startsWith("https://");
      if (isAbsolute && !videoUrl.startsWith(window.location.origin)) {
        video.crossOrigin = "anonymous";
      }
    }

    let resolved = false;
    const cleanup = () => {
      resolved = true;
      video.src = "";
      video.load();
    };

    // 8-second fallback timeout to prevent infinite pending promises
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      cleanup();
      reject(new Error("video capture timeout"));
    }, 8000);

    video.addEventListener(
      "loadedmetadata",
      () => {
        if (resolved) return;
        let seekTime = 1.5;
        if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
          seekTime = Math.min(2.0, video.duration * 0.25);
          if (video.duration < 2.0) {
            seekTime = video.duration * 0.5;
          }
        }
        video.currentTime = seekTime;
      },
      { once: true },
    );

    video.addEventListener(
      "seeked",
      () => {
        if (resolved) return;
        try {
          clearTimeout(timeoutId);
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) { cleanup(); reject(new Error("no canvas ctx")); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          resolve(dataUrl);
        } catch (err) {
          clearTimeout(timeoutId);
          cleanup();
          reject(err);
        }
      },
      { once: true },
    );

    video.addEventListener("error", () => {
      if (resolved) return;
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error("video load error"));
    });

    video.src = videoUrl;
    video.load();
  });
}

/**
 * Dynamically resolves the correct video URL (extension) by probing
 * common web video formats (mp4, mov, webm) in order.
 */
export async function resolveVideoUrl(originalUrl: string): Promise<string> {
  const match = originalUrl.match(/^(.*\/video)\.[a-zA-Z0-9]+$/);
  if (!match) return originalUrl;
  const base = match[1];
  const extensions = ["mp4", "mov", "webm", "MP4", "MOV", "WEBM"];
  
  for (const ext of extensions) {
    const testUrl = `${base}.${ext}`;
    try {
      const res = await fetch(testUrl, { method: "HEAD" });
      if (res.ok) {
        return testUrl;
      }
    } catch (e) {
      // Continue on network errors
    }
  }
  return originalUrl;
}

