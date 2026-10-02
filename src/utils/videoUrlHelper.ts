/**
 * Video URL Normalizer & Direct Stream Converter
 * Handles Google Drive, GitHub Releases/Raw, Dropbox, and Local Storage Streams
 */

export interface VideoUrlAnalysis {
  originalUrl: string;
  streamUrl: string;
  isConverted: boolean;
  platform: 'gdrive' | 'github' | 'dropbox' | 'local' | 'direct' | 'unsupported';
  fileId?: string;
  directOptions?: {
    label: string;
    url: string;
    description: string;
  }[];
  warning?: string;
  suggestion?: string;
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
      platform: 'unsupported'
    };
  }

  // 1. Local Blob or Object URL
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return {
      originalUrl: url,
      streamUrl: url,
      isConverted: false,
      platform: 'local'
    };
  }

  // 2. Google Drive Detection
  if (url.includes('drive.google.com') || url.includes('googleusercontent.com/d/')) {
    const fileId = extractGoogleDriveId(url);
    if (fileId) {
      const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      const ucDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const proxyUrl = `/api/video-stream?url=${encodeURIComponent(ucDownloadUrl)}`;

      return {
        originalUrl: url,
        streamUrl: cdnUrl,
        isConverted: true,
        platform: 'gdrive',
        fileId,
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
        warning: 'Google Drive requires the file to be shared with "Anyone with the link can view". Files > 100MB may prompt Google virus check screens.',
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
      const isServerAvailable = typeof window !== 'undefined' && !window.location.hostname.endsWith('github.io');
      const streamTarget = isServerAvailable ? `/api/video-stream?url=${encodeURIComponent(rawUrl)}` : rawUrl;
      return {
        originalUrl: url,
        streamUrl: streamTarget,
        isConverted: true,
        platform: 'github',
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
        suggestion: 'GitHub Pages asset detected! Fast HTTP 206 range seeking enabled.'
      };
    }

    return {
      originalUrl: url,
      streamUrl: url,
      isConverted: false,
      platform: 'github'
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
      suggestion: 'Dropbox link converted to raw stream with ?raw=1.'
    };
  }

  // 5. Standard Direct Video (.mp4, .webm, etc.) or relative path
  return {
    originalUrl: url,
    streamUrl: url,
    isConverted: false,
    platform: 'direct'
  };
}
