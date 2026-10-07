/**
 * Video URL Normalizer & Direct Stream Converter
 * Handles Google Drive, GitHub Releases/Raw, Dropbox, YouTube (warning), and Local Storage Streams
 */

export interface VideoUrlAnalysis {
  originalUrl: string;
  streamUrl: string;
  isConverted: boolean;
  platform: 'gdrive' | 'github' | 'dropbox' | 'local' | 'direct' | 'youtube' | 'unsupported';
  fileId?: string;
  /**
   * Ordered list of streamable URLs. The player tries candidates[0] first and
   * automatically falls back to the next one when a source fails to load
   * (403 / HTML interstitial / CORS failure). Never empty when streamUrl is set.
   */
  candidates: string[];
  directOptions?: {
    label: string;
    url: string;
    description: string;
  }[];
  warning?: string;
  suggestion?: string;
}

/**
 * Hosts that reliably serve `Access-Control-Allow-Origin: *` so media can be
 * requested with crossOrigin="anonymous" (keeps the walkthrough canvas clean
 * for hosts we know support it).
 *
 * EVERY other cross-origin host must be streamed WITHOUT the CORS attribute.
 * A plain <video> element plays from any host, but requesting CORS from a
 * server that does not send the headers FAILS THE LOAD OUTRIGHT — that was
 * exactly why arbitrary (non-optimized / cinematic) video links could never
 * be scroll-scrubbed: only the local HandBrake-optimized copies worked.
 * Drawing a non-CORS video onto the canvas merely taints it (pixels cannot be
 * read back); the walkthrough never reads pixels, so omitting the attribute
 * is universally safe.
 */
const CORS_FRIENDLY_HOST_RE = /(^|\.)raw\.githubusercontent\.com$|(^|\.)github\.io$|(^|\.)objects\.githubusercontent\.com$/i;

/**
 * True when the URL may be fetched with crossOrigin="anonymous" without
 * risking a load failure: same-origin (relative, blob, data) or a host known
 * to send permissive CORS headers. Unknown cross-origin hosts → false.
 */
export function shouldRequestCors(url: string): boolean {
  if (!url) return false;
  if (/^(blob:|data:)/i.test(url)) return true; // same-origin by construction
  if (!/^https?:\/\//i.test(url)) return true; // relative path → served by this origin
  try {
    const u = new URL(url);
    if (typeof window !== 'undefined' && u.origin === window.location.origin) return true;
    return CORS_FRIENDLY_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Put a media element into the correct CORS mode BEFORE its src is assigned
 * (the attribute must already be in place when resource selection happens).
 * Passes `null` (= attribute removed) for unknown cross-origin hosts so the
 * clip streams from literally any link. Safe to call repeatedly: it only
 * touches the DOM when the mode actually changes.
 */
export function applyVideoCrossOrigin(el: HTMLVideoElement | HTMLImageElement, url: string): void {
  const mode: 'anonymous' | null = shouldRequestCors(url) ? 'anonymous' : null;
  if ((el.crossOrigin ?? null) !== mode) {
    el.crossOrigin = mode;
  }
}

/** True when the app runs on a static host without the Express backend (/api/*). */
export function isStaticHost(): boolean {
  if (typeof window === 'undefined') return true;
  return window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
}

export function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  
  // Format 1: https://drive.google.com/file/d/FILE_ID/view...
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/i);
  if (matchFileD && matchFileD[1]) return matchFileD[1];

  // Format 2: https://drive.google.com/open?id=FILE_ID
  // or https://drive.google.com/uc?id=FILE_ID
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/i);
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1];

  // Format 3: https://lh3.googleusercontent.com/d/FILE_ID
  const matchLh3 = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/i);
  if (matchLh3 && matchLh3[1]) return matchLh3[1];

  return null;
}

export function analyzeAndConvertVideoUrl(rawUrl: string): VideoUrlAnalysis {
  const url = (rawUrl || '').trim();

  if (!url) {
    return {
      originalUrl: '',
      streamUrl: '',
      isConverted: false,
      platform: 'unsupported',
      candidates: []
    };
  }

  // 0. YouTube links cannot be played inside a plain <video> element (no
  //    direct frame-accurate seeking, no MP4 stream). Surface a clear warning.
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
    return {
      originalUrl: url,
      streamUrl: '',
      isConverted: false,
      platform: 'youtube',
      candidates: [],
      warning: 'YouTube links cannot be scrubbed in the walkthrough engine. Download the MP4 and host it on GitHub (repo or Releases) instead.',
      suggestion: 'Use a direct .mp4 URL — GitHub hosting gives true frame-accurate 60FPS scrubbing.'
    };
  }

  // 1. Local Blob or Object URL
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return {
      originalUrl: url,
      streamUrl: url,
      isConverted: false,
      platform: 'local',
      candidates: [url]
    };
  }

  // 2. Google Drive Detection
  if (url.includes('drive.google.com') || url.includes('googleusercontent.com/d/')) {
    const fileId = extractGoogleDriveId(url);
    if (fileId) {
      const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      const ucDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const proxyUrl = `/api/video-stream?url=${encodeURIComponent(ucDownloadUrl)}`;
      const candidates = [cdnUrl, ucDownloadUrl];
      if (!isStaticHost()) {
        // Backend proxy (byte-range) works only where the Express server runs
        candidates.unshift(proxyUrl);
      }

      return {
        originalUrl: url,
        streamUrl: candidates[0],
        isConverted: true,
        platform: 'gdrive',
        fileId,
        candidates,
        directOptions: [
          {
            label: 'Google Direct CDN (Recommended)',
            url: cdnUrl,
            description: 'Direct Google CDN media stream URL without HTML viewer wrapper.'
          },
          {
            label: 'Google Drive Export Stream',
            url: ucDownloadUrl,
            description: 'Direct download stream endpoint for public Drive files.'
          },
          {
            label: 'VibeTour Backend Proxy Stream (with Byte-Range support)',
            url: proxyUrl,
            description: 'Streams through server with full HTTP 206 Partial Content byte ranges for smooth scrubbing.'
          }
        ],
        warning: 'Google Drive requires the file to be shared with "Anyone with the link can view". Files > 100MB may prompt Google virus check screens. If the video does not play, host the MP4 on GitHub instead.',
        suggestion: 'For optimal 60fps scrubbing, GitHub Releases or the repository public/videos/ folder is recommended.'
      };
    }
  }

  // 3. GitHub Detection
  if (url.includes('github.com') || url.includes('github.io') || url.includes('raw.githubusercontent.com')) {
    // Check if it is a GitHub repository blob or raw link (e.g. github.com/owner/repo/raw/... or github.com/owner/repo/blob/...)
    const gitMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)/i);
    let rawUrl = url;
    if (gitMatch) {
      const [, owner, repo, branch, filePath] = gitMatch;
      rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    }

    const isRawGithub = rawUrl.includes('raw.githubusercontent.com');
    if (isRawGithub) {
      const useServer = !isStaticHost();
      const streamTarget = useServer ? `/api/video-stream?url=${encodeURIComponent(rawUrl)}` : rawUrl;
      return {
        originalUrl: url,
        streamUrl: streamTarget,
        isConverted: true,
        platform: 'github',
        candidates: streamTarget !== rawUrl ? [streamTarget, rawUrl] : [rawUrl],
        directOptions: [
          {
            label: 'VibeTour Optimized Video Stream (Recommended)',
            url: streamTarget,
            description: 'Streams with video/mp4 MIME type and HTTP 206 Partial Content byte ranges.'
          },
          {
            label: 'GitHub Direct Raw',
            url: rawUrl,
            description: 'Direct raw media stream from GitHub.'
          }
        ],
        suggestion: 'GitHub media detected! Converted to high-performance video stream with byte-range scrubbing.'
      };
    }

    // GitHub Releases download link
    if (url.includes('/releases/download/')) {
      return {
        originalUrl: url,
        streamUrl: url,
        isConverted: false,
        platform: 'github',
        candidates: [url],
        suggestion: 'GitHub Releases link detected! Direct CDN streaming with byte-range support enabled.'
      };
    }

    // GitHub Pages link
    if (url.includes('.github.io/')) {
      return {
        originalUrl: url,
        streamUrl: url,
        isConverted: false,
        platform: 'github',
        candidates: [url],
        suggestion: 'GitHub Pages asset detected! Fast HTTP 206 range seeking enabled.'
      };
    }

    return {
      originalUrl: url,
      streamUrl: url,
      isConverted: false,
      platform: 'github',
      candidates: [url]
    };
  }

  // 4. Dropbox Detection
  if (url.includes('dropbox.com')) {
    let clean = url.replace(/[?&]dl=0/g, '').replace(/[?&]raw=1/g, '');
    const separator = clean.includes('?') ? '&' : '?';
    const rawDropbox = `${clean}${separator}raw=1`;
    return {
      originalUrl: url,
      streamUrl: rawDropbox,
      isConverted: true,
      platform: 'dropbox',
      candidates: [rawDropbox, url],
      suggestion: 'Dropbox link converted to raw stream with ?raw=1.'
    };
  }

  // 5. Standard Direct Video (.mp4, .webm, etc.) or relative path
  return {
    originalUrl: url,
    streamUrl: url,
    isConverted: false,
    platform: 'direct',
    candidates: [url]
  };
}
