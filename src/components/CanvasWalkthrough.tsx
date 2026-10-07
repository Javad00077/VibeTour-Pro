import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  Compass, 
  Tv, 
  BedDouble, 
  Wine, 
  Sun, 
  Sparkles, 
  Utensils, 
  Flame, 
  Anchor, 
  Palette,
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  X,
  Sliders,
  Layers,
  ArrowRight,
  ShieldCheck,
  Gauge,
  Lock,
  Unlock,
  DoorOpen
} from 'lucide-react';
import { PropertyListing, Room, Hotspot, MaterialItem, PluginConfig } from '../types';
import { soundEngine } from '../utils/audioSynth';
import { analyzeAndConvertVideoUrl, applyVideoCrossOrigin, shouldRequestCors } from '../utils/videoUrlHelper';
import { decideScrub } from '../utils/scrubEngine';
import {
  gsap,
  prefersReducedMotion,
  revealRoomTitle,
  killTween
} from '../utils/gsapScrollEngine';

interface CanvasWalkthroughProps {
  property: PropertyListing;
  config: PluginConfig;
  activeRoomId?: string;
  onSelectRoom?: (roomId: string) => void;
  onOpenCustomizer?: () => void;
  isAdmin?: boolean;
}

// Tuned motion constants (progress units are 0..1 across the whole tour)
const BASE_WHEEL_SENSITIVITY = 0.000085; // progress per deltaY pixel at 1.0x speed
const LERP_RATE = 14;                    // progress chase rate (divided by scrubSmoothing)
const AUTOPLAY_RATE = 0.02;              // progress per second at 1.0x autoplay speed

/**
 * Paint one decoded video frame onto the canvas, replicating CSS
 * `object-fit: cover` (fill the viewport, crop the overflow, keep the
 * aspect ratio). The <video> elements themselves are CSS-hidden
 * (opacity 0) and stacked behind the canvas, so this call is what the
 * visitor actually sees while scrolling.
 *
 * Returns false when the frame is not drawable yet, so the caller can
 * fall back to the static poster instead of painting a black canvas.
 */
function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  vid: HTMLVideoElement,
  width: number,
  height: number
): boolean {
  try {
    if (vid.readyState < 2 || !vid.videoWidth || !vid.videoHeight) return false;
    const videoAspect = vid.videoWidth / vid.videoHeight;
    const canvasAspect = width / height;
    let drawW = width;
    let drawH = height;
    let offsetX = 0;
    let offsetY = 0;
    if (canvasAspect > videoAspect) {
      // Canvas is wider than the video → match the width, crop top/bottom
      drawH = width / videoAspect;
      offsetY = (height - drawH) / 2;
    } else {
      // Canvas is taller than the video → match the height, crop sides
      drawW = height * videoAspect;
      offsetX = (width - drawW) / 2;
    }
    ctx.drawImage(vid, offsetX, offsetY, drawW, drawH);
    return true;
  } catch {
    // Tainted canvas or a not-yet-decodable frame — caller falls back to poster
    return false;
  }
}

// ── Poster pipeline ─────────────────────────────────────────────────────
// Posters are the very first pixels the visitor sees, so they are also the
// first bytes on the critical path. We ship a compressed `.webp` next to every
// `.jpg` (≈55% smaller for the same 720×1280 frame) and try it first; the
// original URL stays as the fallback, so legacy/remote posters keep working.
const POSTER_EXT_RE = /\.(jpe?g|png)$/i;

/**
 * Ordered poster URLs for a room: the compressed sibling first (only for
 * same-origin raster posters we actually shipped a `.webp` for), then the
 * original URL as an unconditional fallback.
 */
export function posterCandidates(url?: string): string[] {
  if (!url) return [];
  const isSameOriginRaster =
    POSTER_EXT_RE.test(url) &&
    !/^(https?:)?\/\//i.test(url) &&
    !/^(blob:|data:)/i.test(url);
  if (!isSameOriginRaster) return [url];
  return [url.replace(POSTER_EXT_RE, '.webp'), url];
}

export const CanvasWalkthrough: React.FC<CanvasWalkthroughProps> = ({
  property,
  config,
  activeRoomId,
  onSelectRoom,
  onOpenCustomizer,
  isAdmin = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // One <video> element per room, stacked in the DOM for instant crossfades.
  // When the whole property shares a single master film, exactly ONE element
  // renders in the DOM (shared-video mode) so only one hardware decoder runs.
  const roomVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const masterVideoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const depthDisplayRef = useRef<HTMLSpanElement | null>(null);
  
  // Kinetic scrubbing mutable refs
  const progressRef = useRef<number>(0);
  const targetProgressRef = useRef<number>(0);
  const activeRoomIndexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const startDragXRef = useRef<number>(0);
  const startDragYRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const lastSeekTimeRef = useRef<number>(0);
  // Per-clip scrub state (keyed by room.id or '__master__'): the newest seek
  // requested while the decoder is busy, and the previous frame's target time
  // used as the feed-forward velocity of the smooth-scrub engine.
  const pendingSeekMapRef = useRef<Map<string, number>>(new Map());
  const lastTargetTimeMapRef = useRef<Map<string, number>>(new Map());
  // Timestamp of the last hard seek per clip — throttles seek retries so a
  // fast fling cannot storm the network with back-to-back range requests
  const hardSeekAtRef = useRef<Map<string, number>>(new Map());
  // Sticky latch: once a clip has delivered its first decodable frame we never
  // fall back to the poster mid-session (prevents poster/video flicker = "jumps")
  const videoLatchedRef = useRef<Set<string>>(new Set());
  const videoUnlockedRef = useRef<boolean>(false);
  const isMobileRef = useRef<boolean>(
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ||
     (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
     ('ontouchstart' in window))
  );
  
  // React State
  const [activeRoom, setActiveRoom] = useState<Room>(property.rooms[0] || {} as Room);
  const [isBufferReady, setIsBufferReady] = useState<boolean>(false);
  const [bufferProgress, setBufferProgress] = useState<number>(15);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHubModal, setShowHubModal] = useState<boolean>(false);
  const [showMaterialsDrawer, setShowMaterialsDrawer] = useState<boolean>(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [lang] = useState<'fa' | 'en'>('en');
  const [fps, setFps] = useState<number>(60);
  const [showStartCue, setShowStartCue] = useState<boolean>(true);
  const isFa = lang === 'fa';

  // Scroll speed comes straight from the sanitized config (admin adjustable)
  const initialSpeed = config.scrollSpeedFactor || 0.5;
  const [scrollSpeed, setScrollSpeed] = useState<number>(initialSpeed);
  const scrollSpeedRef = useRef<number>(initialSpeed);
  const [showSpeedPanel, setShowSpeedPanel] = useState<boolean>(false);
  const [enableGates, setEnableGates] = useState<boolean>(config.enableGlobalCheckpointGates !== false);

  // Checkpoint Decision Gates & Strict Scroll Lock
  const [activeGateRoom, setActiveGateRoom] = useState<Room | null>(null);
  const isGateLockedRef = useRef<boolean>(false);
  const activeGateProgressRef = useRef<number | null>(null);
  const dismissedGatesRef = useRef<Set<string>>(new Set());

  // ── GSAP cinematic layer (keyframe-free scroll) ─────────────────────
  // Title reveal + camera-drift tweens run on GSAP's own ticker; the video
  // path stays untouched (scrubEngine still steers the clip), so ANY mp4 —
  // even one with no usable keyframes — scrubbed smoothly.
  const [roomTitleEl, setRoomTitleEl] = useState<HTMLElement | null>(null);
  const titleTweenRef = useRef<gsap.core.Timeline | null>(null);
  const reducedMotionRef = useRef<boolean>(typeof window !== 'undefined' && prefersReducedMotion());
  // Last applied cinematic tilt — lets the render loop skip GSAP tween churn
  // on idle frames (performance: no per-frame tween when the scroll settled).
  const lastTiltRef = useRef<number>(0);

  // Re-run the cinematic reveal whenever the active room (or the title DOM
  // node) changes. killTween guards against a room change mid-flight.
  useEffect(() => {
    if (!roomTitleEl || !activeRoom) return;
    killTween(titleTweenRef.current);
    titleTweenRef.current = revealRoomTitle(roomTitleEl, reducedMotionRef.current);
    return () => killTween(titleTweenRef.current);
  }, [roomTitleEl, activeRoom?.id]);

  useEffect(() => {
    scrollSpeedRef.current = scrollSpeed;
  }, [scrollSpeed]);

  useEffect(() => {
    const targetSpeed = config.scrollSpeedFactor || 0.5;
    setScrollSpeed(targetSpeed);
    scrollSpeedRef.current = targetSpeed;
  }, [config.scrollSpeedFactor]);

  useEffect(() => {
    if (config.enableGlobalCheckpointGates !== undefined) {
      setEnableGates(config.enableGlobalCheckpointGates);
    }
  }, [config.enableGlobalCheckpointGates]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Prime mobile hardware decoders on first user gesture (muted play/pause roundtrip)
  const unlockMobileVideo = useCallback(() => {
    if (videoUnlockedRef.current) return;
    videoUnlockedRef.current = true;
    roomVideoRefs.current.forEach((vid) => {
      try {
        vid.muted = true;
        const p = vid.play();
        if (p !== undefined) {
          p.then(() => { vid.pause(); }).catch(() => {});
        }
      } catch {
        // safe
      }
    });
  }, []);

  // ------------------------------------------------------------------
  // SHARED-VIDEO MODE: when every chapter rides the same master film,
  // render exactly ONE <video> (single hardware decoder = zero lag).
  // YouTube links are excluded — they cannot be scrubbed in a <video> element.
  // ------------------------------------------------------------------
  const allRoomsShareVideo = useMemo(
    () =>
      property.rooms.length > 1 &&
      property.rooms.every((r) => r.videoUrl && r.videoUrl === property.rooms[0].videoUrl) &&
      analyzeAndConvertVideoUrl(property.rooms[0].videoUrl).candidates.length > 0,
    [property.rooms]
  );

  // Sync video sources with priority: active room + neighbors load first,
  // remaining chambers stream in staged one-by-one so playback starts instantly.
  // The map tracks room.id -> RESOLVED url, so when the admin edits a room's
  // videoUrl the new resolved URL is re-assigned (poster latch reset) instead
  // of being ignored until remount — the stale-URL bug.
  const assignedSrcsRef = useRef<Map<string, string>>(new Map());
  const resolvedCandidatesRef = useRef<Map<string, string[]>>(new Map());

  const resolveCandidates = useCallback((room?: Room): string[] => {
    if (!room || !room.videoUrl || room.videoUrl.startsWith('blob:')) return [];
    return analyzeAndConvertVideoUrl(room.videoUrl).candidates;
  }, []);

  // Attach a fallback walker: on load error, advance to the next candidate
  // (proxy → raw → CDN alternative) instead of dying on the first failure.
  // Candidates can live on DIFFERENT hosts, so the CORS mode is re-applied
  // per candidate before its src (anonymous ↔ plain streaming), matching the
  // initial assignment logic.
  const installCandidateFallback = useCallback((el: HTMLVideoElement, key: string) => {
    el.onerror = () => {
      const list = resolvedCandidatesRef.current.get(key) || [];
      const idx = parseInt(el.dataset.candidateIdx || '0', 10) + 1;
      if (idx < list.length) {
        el.dataset.candidateIdx = String(idx);
        el.dataset.currentStreamUrl = list[idx];
        applyVideoCrossOrigin(el, list[idx]);
        el.src = list[idx];
        el.load();
      }
    };
  }, []);

  // ── Poster promotion bookkeeping (webp-first) ──────────────────────────
  // room.id -> ORIGINAL mediaUrl whose webp/fallback chain already resolved.
  // Keyed by the ORIGINAL url so an admin poster swap is detected immediately:
  // the guard compares against room.mediaUrl, and a mismatch re-runs imgForUrl
  // (whose cache is keyed by URL, so the new poster loads; the old key just
  // becomes an unused cache entry).
  const posterPromotedRef = useRef<Map<string, string>>(new Map());
  // Poster candidates that failed to load (e.g. a legacy room without a webp
  // sibling). Remembered forever so the 60fps render loop never re-requests a
  // 404'ing candidate every frame.
  const posterFailedRef = useRef<Set<string>>(new Set());

  // ── Poster cache (webp-first) ──────────────────────────────────
  // Keyed by poster URL, not room id: when the admin swaps mediaUrl both the
  // "already promoted" guard and the src comparison go stale and would keep
  // the OLD image on the canvas. Cache key = URL, so the new poster loads in.
  /**
   * Fetch (or return from cache) a poster for this URL, trying the compressed
   * `.webp` sibling first and falling back to the original URL. `onDone` fires
   * once per successful candidate — first caller wins.
   *
   * Returns the Image that is currently usable (or in flight), or undefined.
   */
  const imgForUrl = useCallback((url: string, onDone: () => void): HTMLImageElement | undefined => {
    if (!url) return undefined;
    const candidates = posterCandidates(url).filter((src) => !posterFailedRef.current.has(src));
    if (candidates.length === 0) return undefined;
    for (const src of candidates) {
      const img = imageCacheRef.current.get(src);
      if (img?.complete && img.naturalWidth > 0) {
        onDone();
        return img;
      }
    }

    const load = (src: string, next: () => void) => {
      let img = imageCacheRef.current.get(src);
      if (!img) {
        img = new Image();
        // CORS mode only for hosts that send the headers — a plain <img> loads
        // from any host, and the walkthrough never reads canvas pixels back.
        if (shouldRequestCors(src)) img.crossOrigin = 'anonymous';
        imageCacheRef.current.set(src, img);
        img.src = src;
        const fail = () => {
          posterFailedRef.current.add(src);
          imageCacheRef.current.delete(src);
          next();
        };
        if (img.decode) {
          img.decode().then(() => onDone()).catch(fail);
        } else {
          img.onload = () => onDone();
          img.onerror = fail;
        }
      }
      return img;
    };

    if (candidates.length > 1) {
      // Try the compressed candidate; on failure walk to the original.
      return load(candidates[0], () => {
        load(candidates[1], () => {});
      });
    }
    return load(candidates[0], () => {});
  }, []);

  /** Best DECODED image for this poster url, honouring failed candidates. */
  const cachedPoster = useCallback((url?: string): HTMLImageElement | undefined => {
    if (!url) return undefined;
    for (const src of posterCandidates(url)) {
      if (posterFailedRef.current.has(src)) continue;
      const img = imageCacheRef.current.get(src);
      if (img?.complete && img.naturalWidth > 0) return img;
    }
    return undefined;
  }, []);

  useEffect(() => {
    // Shared-video mode: ONE master element carries the whole film — no per-room
    // sources, no staged loading. A single HTTP 206 stream, a single decoder.
    if (allRoomsShareVideo) {
      const vid = masterVideoRef.current;
      const masterRoom = property.rooms[0];
      const candidates = resolveCandidates(masterRoom);
      const resolved = candidates[0] || '';
      if (vid && resolved && vid.dataset.currentStreamUrl !== resolved) {
        vid.dataset.currentStreamUrl = resolved;
        vid.dataset.candidateIdx = '0';
        resolvedCandidatesRef.current.set('__master__', candidates);
        // CORS mode must be settled BEFORE the src so resource selection obeys
        // it — unknown hosts stream WITHOUT crossOrigin (any link plays).
        applyVideoCrossOrigin(vid, resolved);
        // URL changed → drop the sticky latch so the poster shows until the
        // new source delivers its first decodable frame, and reset the
        // smooth-scrub state so the steering loop starts clean
        videoLatchedRef.current.delete('__master__');
        pendingSeekMapRef.current.delete('__master__');
        lastTargetTimeMapRef.current.delete('__master__');
        installCandidateFallback(vid, '__master__');
        vid.src = resolved;
        vid.load();
      }
      assignedSrcsRef.current.clear();
      return;
    }

    // `tier` decides how much of the clip the browser is allowed to fetch:
    //   'auto'     → stream it now (the chamber on screen + its neighbours)
    //   'metadata' → duration/dimensions only, a few KB, until it is visited
    const assignSrc = (room: Room, tier: 'auto' | 'metadata') => {
      const candidates = resolveCandidates(room);
      if (candidates.length === 0) return;
      const resolved = candidates[0];
      const el = roomVideoRefs.current.get(room.id);
      if (!el) return;
      // Re-assign BOTH on first load and whenever the resolved URL changed
      // (edited videoUrl). The old Set-based check assigned only once per
      // mount, so edited links never reached the player.
      // A tier upgrade (metadata → auto) ALSO re-assigns: the clip is already
      // attached but the browser must now stream its bytes eagerly.
      const alreadyAttached = el.dataset.currentStreamUrl === resolved && assignedSrcsRef.current.get(room.id) === resolved;
      if (alreadyAttached && el.preload === tier) return;
      if (alreadyAttached && tier === 'metadata') return; // never downgrade
      assignedSrcsRef.current.set(room.id, resolved);
      resolvedCandidatesRef.current.set(room.id, candidates);
      el.dataset.currentStreamUrl = resolved;
      el.dataset.candidateIdx = '0';
      // Set before src so the first resource selection already obeys the tier
      el.preload = tier;
      // Edited URL → reset the latch so the new clip latches cleanly, and
      // reset the smooth-scrub state for the same reason
      videoLatchedRef.current.delete(room.id);
      pendingSeekMapRef.current.delete(room.id);
      lastTargetTimeMapRef.current.delete(room.id);
      installCandidateFallback(el, room.id);
      // CORS mode before src — unknown hosts stream WITHOUT crossOrigin, so
      // ANY video link (cinematic long-GOP included) loads and scrubs.
      applyVideoCrossOrigin(el, resolved);
      el.src = resolved;
      el.load();
    };

    const videoRooms = property.rooms.filter((r) => r.videoUrl && !r.videoUrl.startsWith('blob:'));
    const activeIdx = Math.max(0, property.rooms.findIndex((r) => r.id === activeRoom.id));

    // ── Smart staging ──────────────────────────────────────────────────
    // Before, every chamber attached with `preload="auto"`, so the whole tour
    // (tens of MB) competed with the very first frame the visitor waits for.
    // Now only what is about to be seen is streamed eagerly.
    //
    // Tier 0 — the chamber on screen right now.
    assignSrc(property.rooms[activeIdx], 'auto');

    // Tier 1 — the two neighbours, needed for the crossfade on the next scroll.
    // One tick later, so the active clip owns the first bytes on the socket.
    const neighbourTimer = window.setTimeout(() => {
      if (property.rooms[activeIdx + 1]) assignSrc(property.rooms[activeIdx + 1], 'auto');
      if (property.rooms[activeIdx - 1]) assignSrc(property.rooms[activeIdx - 1], 'auto');
    }, 600);

    // Tier 2 — the rest of the tour, one at a time, and only metadata.
    let stageTimer = 0;
    let cancelled = false;
    const stageNext = () => {
      if (cancelled) return;
      const next = videoRooms.find((r) => !assignedSrcsRef.current.has(r.id));
      if (!next) return;
      assignSrc(next, 'metadata');
      // Sequential, not parallel: six simultaneous range requests would starve
      // the chamber the visitor is actually looking at.
      stageTimer = window.setTimeout(stageNext, 900);
    };
    stageTimer = window.setTimeout(stageNext, 2200);

    return () => {
      cancelled = true;
      window.clearTimeout(neighbourTimer);
      window.clearTimeout(stageTimer);
    };
  }, [property.rooms, activeRoom.id, allRoomsShareVideo, resolveCandidates, installCandidateFallback]);

  // Attach & warm the master video element so the first scroll tick paints instantly
  useEffect(() => {
    if (!allRoomsShareVideo) return;
    const vid = masterVideoRef.current;
    if (!vid) return;
    const warm = () => {
      try {
        vid.currentTime = 0.001;
      } catch {}
    };
    if (vid.readyState >= 1) warm();
    else vid.addEventListener('loadeddata', warm, { once: true });
  }, [allRoomsShareVideo]);

  // Map icon names
  const renderRoomIcon = (iconName: string, className: string = 'w-4 h-4') => {
    switch (iconName) {
      case 'Tv': return <Tv className={className} />;
      case 'BedDouble': return <BedDouble className={className} />;
      case 'Wine': return <Wine className={className} />;
      case 'Sun': return <Sun className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Utensils': return <Utensils className={className} />;
      case 'Flame': return <Flame className={className} />;
      case 'Anchor': return <Anchor className={className} />;
      case 'Palette': return <Palette className={className} />;
      case 'Compass':
      default:
        return <Compass className={className} />;
    }
  };

  // Find room by progress
  const getRoomByProgress = useCallback((prog: number): { room: Room; index: number } => {
    const rooms = property.rooms;
    if (!rooms || rooms.length === 0) return { room: {} as Room, index: 0 };
    for (let i = 0; i < rooms.length; i++) {
      if (prog >= rooms[i].startProgress && prog <= rooms[i].endProgress) {
        return { room: rooms[i], index: i };
      }
    }
    return prog < rooms[0].startProgress
      ? { room: rooms[0], index: 0 }
      : { room: rooms[rooms.length - 1], index: rooms.length - 1 };
  }, [property.rooms]);

  // Preload poster images and show buffer shimmer
  useEffect(() => {
    setIsBufferReady(false);
    setBufferProgress(15);
    let loadedCount = 0;
    const total = Math.max(1, property.rooms.length);

    property.rooms.forEach((room) => {
      // Already promoted for THIS poster URL → instant count, zero re-fetch.
      if (posterPromotedRef.current.get(room.id) === room.mediaUrl) {
        loadedCount++;
        setBufferProgress(Math.round((loadedCount / total) * 100));
        return;
      }
      const onDone = (loadedVia: string) => {
        // Only the run whose URL is still current promotes the room; a stale
        // closure from a previous mediaUrl must not mark the new poster ready.
        if (room.mediaUrl !== loadedVia) return;
        posterPromotedRef.current.set(room.id, loadedVia);
        loadedCount++;
        const pct = Math.round((loadedCount / total) * 100);
        setBufferProgress(pct);
        if (pct >= 20) {
          setIsBufferReady(true);
        }
      };

      imgForUrl(room.mediaUrl, () => onDone(room.mediaUrl));
    });

    const timer = setTimeout(() => {
      setIsBufferReady(true);
      setBufferProgress(100);
    }, 2500);

    return () => clearTimeout(timer);
  }, [property.rooms]);

  // Jump to activeRoomId if changed externally or sync active room when property.rooms updates
  useEffect(() => {
    if (!property.rooms || property.rooms.length === 0) return;
    const targetId = activeRoomId || activeRoom.id;
    const matched = property.rooms.find((r) => r.id === targetId) || property.rooms[0];
    if (matched) {
      setActiveRoom(matched);
      const idx = property.rooms.indexOf(matched);
      activeRoomIndexRef.current = idx >= 0 ? idx : 0;
      if (activeRoomId && targetId === activeRoomId) {
        jumpToRoom(matched, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, property.rooms]);

  // Jump to specific room
  const jumpToRoom = (room: Room, immediate: boolean = true) => {
    if (!room) return;
    // Release any checkpoint gate lock
    isGateLockedRef.current = false;
    activeGateProgressRef.current = null;
    setActiveGateRoom(null);

    const roomRange = Math.max(0.01, room.endProgress - room.startProgress);
    // Enter exactly at the chapter's first frame so its video starts from 0s
    const startOfRoom = Math.min(0.999, room.startProgress + roomRange * 0.001);
    targetProgressRef.current = startOfRoom;
    if (immediate) {
      progressRef.current = startOfRoom;
    }
    const idx = property.rooms.indexOf(room);
    activeRoomIndexRef.current = idx >= 0 ? idx : 0;
    setActiveRoom(room);
    setSelectedHotspot(null);
    setShowHubModal(false);
    soundEngine.triggerHapticChime(560);
    
    // Select first material for drawer
    if (room.materials && room.materials.length > 0) {
      setSelectedMaterial(room.materials[0]);
    } else {
      setSelectedMaterial(null);
    }

    if (onSelectRoom) {
      onSelectRoom(room.id);
    }
  };

  // Unlock active checkpoint gate and let user continue in the current room
  const unlockCurrentGateAndContinue = () => {
    if (activeGateRoom) {
      dismissedGatesRef.current.add(activeGateRoom.id);
    }
    isGateLockedRef.current = false;
    activeGateProgressRef.current = null;
    setActiveGateRoom(null);
    soundEngine.triggerHapticChime(620);
  };

  // Return to Living Hub (Central Great Room)
  const returnToHub = () => {
    const hubRoom = property.rooms.find((r) => r.isHub) || property.rooms[1] || property.rooms[0];
    if (hubRoom) {
      jumpToRoom(hubRoom, true);
      setShowHubModal(true);
    }
  };

  // Audio Toggle
  const toggleSound = () => {
    if (isMuted) {
      soundEngine.play();
      setIsMuted(false);
      soundEngine.triggerHapticChime(520);
    } else {
      soundEngine.pause();
      setIsMuted(true);
    }
  };

  // Trigger a checkpoint gate at the given room boundary
  const triggerGate = (room: Room, gateGlobalProgress: number) => {
    isGateLockedRef.current = true;
    activeGateProgressRef.current = gateGlobalProgress;
    setActiveGateRoom(room);
    setIsPlaying(false);
    soundEngine.triggerHapticChime(580);
  };

  // Wheel listener with normalized deltas, configurable speed and strict checkpoint locking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      unlockMobileVideo();

      // Normalize delta across browsers (pixel / line / page modes)
      let rawDelta = e.deltaY;
      if (e.deltaMode === 1) rawDelta = rawDelta * 16;
      else if (e.deltaMode === 2) rawDelta = rawDelta * 100;

      const speedFactor = Math.max(0.05, scrollSpeedRef.current);
      const delta = rawDelta * BASE_WHEEL_SENSITIVITY * speedFactor;

      // 1. Strict Forward Scroll Lock Enforcement
      if (isGateLockedRef.current) {
        if (delta > 0) {
          // STRICTLY PREVENT PASSING THE GATE WHEN SCROLLING FORWARD
          if (activeGateProgressRef.current !== null) {
            targetProgressRef.current = activeGateProgressRef.current;
          }
          return;
        } else {
          // Allow scrolling backwards to view previous moments
          targetProgressRef.current = Math.max(0, targetProgressRef.current + delta);
        }
        return;
      }

      // 2. Compute proposed target progress
      let nextProg = Math.max(0, Math.min(1, targetProgressRef.current + delta));

      // 3. Evaluate room checkpoint gate
      if (delta > 0 && enableGates) {
        const { room: currRoom } = getRoomByProgress(nextProg);
        if (currRoom && currRoom.enablePauseGate && !dismissedGatesRef.current.has(currRoom.id)) {
          const gateFactor = currRoom.pauseCheckpointProgress ?? 0.85;
          const roomRange = currRoom.endProgress - currRoom.startProgress;
          const gateGlobalProgress = currRoom.startProgress + roomRange * gateFactor;

          if (nextProg >= gateGlobalProgress) {
            nextProg = gateGlobalProgress;
            triggerGate(currRoom, gateGlobalProgress);
          }
        }
      }

      targetProgressRef.current = nextProg;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        if (isGateLockedRef.current) return;
        const step = e.key === 'PageDown' ? 0.08 : 0.02;
        let nextProg = Math.min(1, targetProgressRef.current + step);
        if (enableGates) {
          const { room: currRoom } = getRoomByProgress(nextProg);
          if (currRoom && currRoom.enablePauseGate && !dismissedGatesRef.current.has(currRoom.id)) {
            const gateFactor = currRoom.pauseCheckpointProgress ?? 0.85;
            const roomRange = currRoom.endProgress - currRoom.startProgress;
            const gateGlobalProgress = currRoom.startProgress + roomRange * gateFactor;
            if (nextProg >= gateGlobalProgress) {
              nextProg = gateGlobalProgress;
              triggerGate(currRoom, gateGlobalProgress);
            }
          }
        }
        targetProgressRef.current = nextProg;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        const step = e.key === 'PageUp' ? 0.08 : 0.02;
        targetProgressRef.current = Math.max(0, targetProgressRef.current - step);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (!isGateLockedRef.current) {
          setIsPlaying((prev) => !prev);
        }
      } else if (e.key === 'Escape') {
        setShowMaterialsDrawer(false);
        setSelectedHotspot(null);
        setShowHubModal(false);
        setShowSpeedPanel(false);
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enableGates, getRoomByProgress, unlockMobileVideo]);

  // ------------------------------------------------------------------
  // SMOOTH-SCRUB ENGINE: pausing the clip and jumping `currentTime` only
  // shows ONE new frame per network seek — the "chunky scroll" report.
  // Instead, while the visitor scrubs FORWARD, the clip is PLAYED and
  // steered with `playbackRate` (feed-forward scroll velocity + gentle
  // proportional error correction), so the decoder emits consecutive
  // frames at its native rate and the motion is fluid.
  //
  // Forward-only by construction: the clip must NEVER run past the scroll
  // position. HTML video cannot play in reverse, so the moment the frame
  // sits ahead of the target we FREEZE it (and seek back only when the
  // gap grows past a tolerance). Flooring the rate instead — which an
  // earlier revision did — made the clip creep ahead on its own while the
  // visitor was idle, and every backward scroll then had to pay that debt
  // back with seeks, which showed up as lag.
  // ------------------------------------------------------------------
  const steerVideo = useCallback(
    (vid: HTMLVideoElement, key: string, targetTime: number, dt: number, dur: number) => {
      // Track the target velocity every frame (also right after hard seeks)
      const prev = lastTargetTimeMapRef.current.get(key) ?? targetTime;
      lastTargetTimeMapRef.current.set(key, targetTime);

      // While the decoder is busy OR still fetching data for the current
      // position, keep only the newest request — issuing another seek now
      // would cancel the in-flight range request and thrash the network.
      if (vid.seeking || vid.readyState < 3) {
        pendingSeekMapRef.current.set(key, targetTime);
        return;
      }
      const pending = pendingSeekMapRef.current.get(key);
      pendingSeekMapRef.current.delete(key);

      const now = performance.now();
      const action = decideScrub({
        targetTime: pending !== undefined ? pending : targetTime,
        currentTime: vid.currentTime,
        duration: dur,
        velocity: dt > 0 ? (targetTime - prev) / dt : 0,
        lastHardSeekAt: hardSeekAtRef.current.get(key) ?? 0,
        now
      });

      switch (action.kind) {
        case 'seek':
          hardSeekAtRef.current.set(key, now);
          lastSeekTimeRef.current = now;
          {
            const w = window as unknown as { __vbtHardSeeks?: number };
            w.__vbtHardSeeks = (w.__vbtHardSeeks || 0) + 1;
          }
          try {
            vid.currentTime = action.time;
          } catch {
            // seek race — retried on the next frame
          }
          break;
        case 'play':
          {
            const w = window as unknown as { __vbtSteerFrames?: number };
            w.__vbtSteerFrames = (w.__vbtSteerFrames || 0) + 1;
          }
          if (vid.paused) {
            vid.play().catch(() => {
              // Gesture-policy rejection (rare for muted clips): the hard-seek
              // path above still keeps the tour usable on the following frames
            });
          }
          if (Math.abs(vid.playbackRate - action.rate) > 0.02) {
            try { vid.playbackRate = action.rate; } catch {}
          }
          break;
        case 'hold':
          // Hold the decoded frame — the canvas keeps painting it, so there is
          // no poster flash, no drift ahead, and no wasted decode work.
          if (!vid.paused) vid.pause();
          break;
        default:
          break;
      }
    },
    []
  );

  // Main 60FPS Render Loop
  useEffect(() => {
    let frameCount = 0;
    let fpsTimer = performance.now();
    let lastRoomId = property.rooms[0]?.id;
    let lastCueVisible = true;

    const renderLoop = (time: number) => {
      const dt = Math.min(0.1, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      // Calculate FPS
      frameCount++;
      if (time - fpsTimer > 1000) {
        setFps(Math.round((frameCount * 1000) / (time - fpsTimer)));
        frameCount = 0;
        fpsTimer = time;
      }

      // Autoplay (frame-rate independent)
      if (isPlayingRef.current) {
        targetProgressRef.current += dt * AUTOPLAY_RATE * (config.autoplaySpeed || 1);
        if (targetProgressRef.current > 1.0) {
          targetProgressRef.current = 0;
        }
      }

      // Smooth inertia: progress chases target exponentially (dt-based, monitor independent)
      const diff = targetProgressRef.current - progressRef.current;
      const smoothRate = Math.min(1, (dt * LERP_RATE) / Math.max(0.8, config.scrubSmoothing));
      progressRef.current += diff * smoothRate;

      if (progressRef.current < 0) progressRef.current = 0;
      if (progressRef.current > 1) progressRef.current = 1;

      const currentProg = progressRef.current;

      // Hide the start cue once the tour begins
      const cueVisible = currentProg < 0.04;
      if (cueVisible !== lastCueVisible) {
        lastCueVisible = cueVisible;
        setShowStartCue(cueVisible);
      }

      // Update DOM progress bar & timers directly
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${(currentProg * 100).toFixed(2)}%`;
      }
      if (depthDisplayRef.current) {
        depthDisplayRef.current.textContent = `${Math.round(currentProg * 100)}% TOUR DEPTH`;
      }

      // GSAP cinematic layer: subtle camera drift tied to scroll velocity.
      // Applied to the CANVAS transform only — the video decode path,
      // scrubEngine decisions, and the DOM overlay are untouched, so this
      // stays "attractive but never fights the scrub".
      if (!reducedMotionRef.current && canvasRef.current) {
        const tilt = Math.max(-1.4, Math.min(1.4, (targetProgressRef.current - currentProg) * 26));
        // Idle guard: only retarget the tween while the tilt is moving or was
        // moving last frame (lets the settle-tween finish, then stops churning)
        if (Math.abs(tilt) > 0.004 || Math.abs(lastTiltRef.current) > 0.004) {
          gsap.to(canvasRef.current, {
            scale: 1.045 + Math.abs(tilt) * 0.006,
            rotate: tilt * 0.12,
            duration: 0.4,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        }
        lastTiltRef.current = tilt;
      }

      // Check current room
      const { room: currRoom, index: currRoomIdx } = getRoomByProgress(currentProg);

      if (timeDisplayRef.current) {
        // Show the ACTIVE CHAPTER's local film clock (each section restarts at 0)
        const mv = allRoomsShareVideo ? masterVideoRef.current : null;
        const filmDur = mv && Number.isFinite(mv.duration) && mv.duration > 0 ? mv.duration : 0;
        const localSec = (currentProg * (filmDur || 60));
        const roomStartSec = filmDur ? currRoom.startProgress * filmDur : 0;
        const secs = Math.max(0, Math.round(localSec - roomStartSec));
        timeDisplayRef.current.textContent = `00:${String(Math.min(59, secs)).padStart(2, '0')}`;
      }

      if (currRoom && currRoom.id !== lastRoomId) {
        lastRoomId = currRoom.id;
        activeRoomIndexRef.current = currRoomIdx;
        setActiveRoom(currRoom);
        soundEngine.triggerHapticChime(480);
      }

      // Canvas Rendering
      const canvas = canvasRef.current;
      if (canvas && currRoom && currRoom.id) {
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          const roomRange = Math.max(0.01, currRoom.endProgress - currRoom.startProgress);
          const localProg = Math.max(0, Math.min(1, (currentProg - currRoom.startProgress) / roomRange));

          // Free the decoder + network for the ACTIVE clip: pause every other
          // chamber's clip (steering leaves them playing after a room change;
          // concurrent decoders/range requests = stutter). Shared mode has a
          // single element, nothing to clean up.
          if (!allRoomsShareVideo) {
            roomVideoRefs.current.forEach((other, id) => {
              if (id !== currRoom.id && !other.paused) other.pause();
            });
          }

          // 1. VIDEO SCRUBBING — shared master film (single decoder) or per-chamber clips.
          // Shared mode scrubs by the ACTIVE CHAPTER's local progress so the film
          // restarts from its first frame in every section of the house.
          let videoRendered = false;
          // Latched but THIS frame is not drawable (seek stall / readyState dip on
          // cross-origin streams). The canvas keeps its previous content — the last
          // decoded frame — so the poster NEVER interleaves mid-session. This is the
          // fix for the reported one-frame-video / one-frame-poster flicker.
          let videoHeldFrame = false;
          const hasVideo = !!currRoom.videoUrl && !currRoom.videoUrl.startsWith('blob:') && analyzeAndConvertVideoUrl(currRoom.videoUrl).candidates.length > 0;
          const sharedMaster = allRoomsShareVideo ? masterVideoRef.current : null;
          // Adaptive seek threshold: frame-accurate for same-origin/local sources,
          // relaxed for cross-origin streams where every seek is a network
          // round-trip (aggressive seeking = stutter + lag).
          const seekDriftThreshold = (vid: HTMLVideoElement) =>
            isMobileRef.current || vid.crossOrigin === 'anonymous'
              ? 0.05
              : vid.src && !vid.src.startsWith(window.location.origin) && /^https?:/i.test(vid.src)
                ? 0.03
                : 0.016;

          if (sharedMaster) {
            const vid = sharedMaster;
            if (!vid.error) {
              const dur = Number.isFinite(vid.duration) ? vid.duration : 0;

              // Play/pause follows the transport state; during autoplay the video's
              // own clock drives the frames (playbackRate mapped to progress rate)
              if (isPlayingRef.current) {
                if (vid.paused) {
                  vid.play().catch(() => {});
                }
                const filmRate = Math.max(0.0625, Math.min(4, AUTOPLAY_RATE * (config.autoplaySpeed || 1) * dur));
                if (Math.abs(vid.playbackRate - filmRate) > 0.01) {
                  try { vid.playbackRate = filmRate; } catch {}
                }

                if (dur > 0) {
                  // Keep autoplay on rails (keyed seek coalescing)
                  const targetTime = Math.max(0, Math.min(dur - 0.033, localProg * dur));
                  if (vid.seeking) {
                    pendingSeekMapRef.current.set('__master__', targetTime);
                  } else {
                    const pending = pendingSeekMapRef.current.get('__master__');
                    pendingSeekMapRef.current.delete('__master__');
                    const wanted = pending !== undefined ? pending : targetTime;
                    if (Math.abs(vid.currentTime - wanted) > seekDriftThreshold(vid)) {
                      lastSeekTimeRef.current = performance.now();
                      try {
                        vid.currentTime = Math.max(0, Math.min(dur - 0.033, wanted));
                      } catch {
                        // seek race — retried on the next frame
                      }
                    }
                  }
                }
              } else if (dur > 0) {
                // Manual scrub: play the clip and steer it with playbackRate so
                // the decoder emits consecutive frames — fluid, no seek jumps
                const targetTime = Math.max(0, Math.min(dur - 0.033, localProg * dur));
                steerVideo(vid, '__master__', targetTime, dt, dur);
              } else if (!vid.paused) {
                vid.pause();
              }

              // Show the video layer once a frame is decodable and KEEP it shown
              // (browsers hold the last decoded frame during seeks — no black flash)
              if (vid.readyState >= 2) {
                videoLatchedRef.current.add('__master__');
              }
              if (!vid.error && videoLatchedRef.current.has('__master__')) {
                // No clearRect: drawVideoCover fills the whole viewport (cover
                // geometry), and skipping the clear means an undrawable frame
                // simply holds the previous frame instead of flashing the poster.
                if (drawVideoCover(ctx, vid, width, height)) {
                  videoRendered = true;
                } else {
                  videoHeldFrame = true;
                }
              }
            }
          } else if (hasVideo) {
            const vid = roomVideoRefs.current.get(currRoom.id);
            if (vid && !vid.error) {
              const scrubProgress = localProg;

              if (isPlayingRef.current) {
                // Autoplay: rate-map the clip to the tour speed (same as shared
                // mode) so its own clock drives frames instead of jerky seeks
                const dur = Number.isFinite(vid.duration) ? vid.duration : 0;
                if (vid.paused) {
                  vid.play().catch(() => {});
                }
                if (dur > 0) {
                  const filmRate = Math.max(0.0625, Math.min(4, AUTOPLAY_RATE * (config.autoplaySpeed || 1) * dur));
                  if (Math.abs(vid.playbackRate - filmRate) > 0.01) {
                    try { vid.playbackRate = filmRate; } catch {}
                  }
                  const targetTime = Math.max(0, Math.min(dur - 0.033, scrubProgress * dur));
                  if (vid.seeking) {
                    pendingSeekMapRef.current.set(currRoom.id, targetTime);
                  } else {
                    const pending = pendingSeekMapRef.current.get(currRoom.id);
                    pendingSeekMapRef.current.delete(currRoom.id);
                    const wanted = pending !== undefined ? pending : targetTime;
                    if (Math.abs(vid.currentTime - wanted) > seekDriftThreshold(vid)) {
                      lastSeekTimeRef.current = performance.now();
                      try {
                        vid.currentTime = Math.max(0, Math.min(dur - 0.033, wanted));
                      } catch {
                        // seek race — retried next frame
                      }
                    }
                  }
                }
              } else if (vid.duration && Number.isFinite(vid.duration)) {
                // Manual scrub: play the clip and steer it with playbackRate —
                // consecutive decoded frames = fluid motion (no per-seek jumps)
                const targetTime = Math.max(0, Math.min(vid.duration - 0.033, scrubProgress * vid.duration));
                steerVideo(vid, currRoom.id, targetTime, dt, vid.duration);
              } else if (!vid.paused) {
                vid.pause();
              }

              // Same sticky latch as shared mode — no poster flicker on the active clip
              if (vid.readyState >= 2) {
                videoLatchedRef.current.add(currRoom.id);
              }
              if (videoLatchedRef.current.has(currRoom.id)) {
                // No clearRect (same reason as shared mode): hold the last decoded
                // frame whenever this frame is briefly undrawable — no poster flash.
                if (drawVideoCover(ctx, vid, width, height)) {
                  videoRendered = true;
                } else {
                  videoHeldFrame = true;
                }
              }
            }
          }

          if (!videoRendered && !videoHeldFrame) {
            // 2. STATIC POSTER (only while a video buffers or when a room has none) —
            // drawn flat, no zoom / pan / fake camera effects
            // Debug telemetry: count poster paints after a video latch (must stay 0)
            if (videoLatchedRef.current.has(currRoom.id) || videoLatchedRef.current.has('__master__')) {
              const w = window as unknown as { __vbtPosterAfterLatch?: number };
              w.__vbtPosterAfterLatch = (w.__vbtPosterAfterLatch || 0) + 1;
            }
            // Draw the poster for the room's CURRENT mediaUrl (webp-first,
            // URL-keyed cache) while its clip is still buffering.
            let img = cachedPoster(currRoom.mediaUrl);
            if (!img && currRoom.mediaUrl) {
              // Lazy, webp-first: pass a no-op callback — nothing re-renders
              // from here, the canvas just draws whatever is cached next frame.
              img = imgForUrl(currRoom.mediaUrl, () => {});
            }

            ctx.fillStyle = '#090a0f';
            ctx.fillRect(0, 0, width, height);

            if (img && img.complete && img.naturalWidth > 0) {
              const imgAspect = img.naturalWidth / img.naturalHeight;
              const canvasAspect = width / height;
              let drawW = width;
              let drawH = height;
              let offsetX = 0;
              let offsetY = 0;

              if (canvasAspect > imgAspect) {
                drawH = width / imgAspect;
                offsetY = (height - drawH) / 2;
              } else {
                drawW = height * imgAspect;
                offsetX = (width - drawW) / 2;
              }

              ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            }
          }

          // 1. Render Interactive Material Beacons (Click to view specs and origin)
          if (currRoom.materials && currRoom.materials.length > 0) {
            currRoom.materials.forEach((mat) => {
              const mx = ((mat.x ?? 50) / 100) * width;
              const my = ((mat.y ?? 50) / 100) * height;
              const pulse = (Math.sin(time * 0.005 + (mat.x || 0)) + 1) / 2;

              // Outer diamond ripple
              ctx.save();
              ctx.translate(mx, my);
              ctx.rotate(Math.PI / 4);

              ctx.strokeStyle = `rgba(197, 168, 128, ${0.4 - pulse * 0.25})`;
              ctx.lineWidth = 1.5;
              const size = 12 + pulse * 6;
              ctx.strokeRect(-size / 2, -size / 2, size, size);

              // Solid diamond core
              ctx.fillStyle = '#c5a880';
              ctx.fillRect(-4, -4, 8, 8);
              ctx.restore();

              // Material Badge Tag
              const matTitle = isFa && mat.nameFa ? mat.nameFa : mat.name;
              ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
              const textWidth = ctx.measureText(matTitle).width;
              
              ctx.fillStyle = 'rgba(14, 16, 26, 0.92)';
              ctx.beginPath();
              ctx.roundRect(mx + 12, my - 13, textWidth + 24, 26, 8);
              ctx.fill();
              ctx.strokeStyle = 'rgba(197, 168, 128, 0.45)';
              ctx.lineWidth = 1;
              ctx.stroke();

              // Icon indicator
              ctx.fillStyle = '#c5a880';
              ctx.beginPath();
              ctx.arc(mx + 22, my, 3, 0, Math.PI * 2);
              ctx.fill();

              // Text
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'left';
              ctx.fillText(matTitle, mx + 30, my + 4);
            });
          }

          // 2. Render Room Highlight Hotspots
          const currentFrame = Math.round(localProg * (currRoom.totalFrames || 90));
          if (currRoom.hotspots) {
            currRoom.hotspots.forEach((hs) => {
              if (currentFrame >= hs.frameRange[0] && currentFrame <= hs.frameRange[1]) {
                const hx = (hs.x / 100) * width;
                const hy = (hs.y / 100) * height;

                const pulse = (Math.sin(time * 0.006) + 1) / 2;
                ctx.beginPath();
                ctx.arc(hx, hy, 14 + pulse * 6, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(230, 213, 189, ${0.4 - pulse * 0.3})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(hx, hy, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#e6d5bd';
                ctx.fill();

                const titleText = isFa && hs.titleFa ? hs.titleFa : hs.title;
                ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
                const textWidth = ctx.measureText(titleText).width;
                ctx.fillStyle = 'rgba(14, 16, 24, 0.88)';
                ctx.beginPath();
                ctx.roundRect(hx + 10, hy - 13, textWidth + 18, 24, 6);
                ctx.fill();
                ctx.strokeStyle = 'rgba(230, 213, 189, 0.35)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.fillText(titleText, hx + 18, hy + 3);
              }
            });
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [property.rooms, config, getRoomByProgress, isFa, allRoomsShareVideo]);

  // Resize Observer
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width * (window.devicePixelRatio > 1 ? 1.5 : 1);
        canvasRef.current.height = rect.height * (window.devicePixelRatio > 1 ? 1.5 : 1);
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Pointer / Touch Handlers for Mobile & Desktop Scrubbing
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    unlockMobileVideo();
    isDraggingRef.current = true;
    startDragXRef.current = e.clientX;
    startDragYRef.current = e.clientY;
    startProgressRef.current = targetProgressRef.current;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // safe
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaY = startDragYRef.current - e.clientY;
    const deltaX = startDragXRef.current - e.clientX;
    const isMobile = isMobileRef.current;
    // On mobile screens, take the dominant axis so horizontal swipes also glide through rooms
    const primaryDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    const speedFactor = Math.max(0.05, scrollSpeedRef.current);
    const dragSens = (isMobile ? 0.0022 : 0.0018) * speedFactor;
    const delta = primaryDelta * dragSens;

    // 1. Strict Scroll Lock Check
    if (isGateLockedRef.current) {
      if (delta > 0) {
        if (activeGateProgressRef.current !== null) {
          targetProgressRef.current = activeGateProgressRef.current;
        }
        return;
      } else {
        targetProgressRef.current = Math.max(0, startProgressRef.current + delta);
      }
      return;
    }

    let nextProg = Math.max(0, Math.min(1, startProgressRef.current + delta));

    // 2. Check for Checkpoint Gate trigger on forward movement
    if (delta > 0 && enableGates) {
      const { room: currRoom } = getRoomByProgress(nextProg);
      if (currRoom && currRoom.enablePauseGate && !dismissedGatesRef.current.has(currRoom.id)) {
        const gateFactor = currRoom.pauseCheckpointProgress ?? 0.85;
        const roomRange = currRoom.endProgress - currRoom.startProgress;
        const gateGlobalProgress = currRoom.startProgress + roomRange * gateFactor;

        if (nextProg >= gateGlobalProgress) {
          nextProg = gateGlobalProgress;
          triggerGate(currRoom, gateGlobalProgress);
        }
      }
    }

    targetProgressRef.current = nextProg;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // safe
    }
  };

  // Canvas Click for Hotspots & Material Beacons
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const currentProg = progressRef.current;
    const { room: currRoom } = getRoomByProgress(currentProg);
    if (!currRoom) return;

    // 1. Check if user clicked a Material Beacon Point
    if (currRoom.materials && currRoom.materials.length > 0) {
      const matchedMaterial = currRoom.materials.find((mat) => {
        const mx = mat.x ?? 50;
        const my = mat.y ?? 50;
        const dist = Math.hypot(clickX - mx, clickY - my);
        return dist < 14; // Generous tap target for mobile
      });

      if (matchedMaterial) {
        setSelectedMaterial(matchedMaterial);
        setShowMaterialsDrawer(true);
        setSelectedHotspot(null);
        soundEngine.triggerHapticChime(680);
        return;
      }
    }

    // 2. Check if user clicked a Highlight Hotspot Point
    const roomRange = Math.max(0.01, currRoom.endProgress - currRoom.startProgress);
    const localProg = Math.max(0, Math.min(1, (currentProg - currRoom.startProgress) / roomRange));
    const currentFrame = Math.round(localProg * (currRoom.totalFrames || 90));

    const matchedHotspot = (currRoom.hotspots || []).find((hs) => {
      const inFrame = currentFrame >= hs.frameRange[0] && currentFrame <= hs.frameRange[1];
      const dist = Math.hypot(clickX - hs.x, clickY - hs.y);
      return inFrame && dist < 12;
    });

    if (matchedHotspot) {
      setSelectedHotspot(matchedHotspot);
      soundEngine.triggerHapticChime(640);
    } else {
      setSelectedHotspot(null);
    }
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const isPastEntrance = property.rooms.length > 1 && property.rooms.indexOf(activeRoom) >= 1;
  const isAtHub = activeRoom.isHub;
  const currentChamberNumber = property.rooms.indexOf(activeRoom) + 1;
  const roomsWithVideo = property.rooms.filter((r) => r.videoUrl && !r.videoUrl.startsWith('blob:'));

  return (
    <div 
      ref={containerRef}
      id="vbt-tour-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      tabIndex={0}
      dir="ltr"
      className={`relative w-full overflow-hidden select-none bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center outline-none touch-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-[100dvh] w-screen'
          : 'h-[56vh] sm:h-[78vh] min-h-[360px] sm:min-h-[520px] max-h-[860px] rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl shadow-black/90'
      }`}
    >

      {/* Video Layers — one preloaded clip per chamber, crossfaded.
          Shared-video mode renders a SINGLE master <video> (one decoder). */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {allRoomsShareVideo ? (
          <video
            ref={(el) => {
              masterVideoRef.current = el;
              if (el) roomVideoRefs.current.set('__master__', el);
            }}
            data-room-id="__master__"
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
        roomsWithVideo.map((room) => (
          <video
            key={room.id}
            data-room-id={room.id}
            ref={(el) => {
              if (el) {
                roomVideoRefs.current.set(room.id, el);
              } else {
                roomVideoRefs.current.delete(room.id);
              }
            }}
            muted
            playsInline
            loop
            preload="auto"
            disablePictureInPicture
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out ${
              activeRoom.id === room.id ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))
        )}
      </div>

      {/* 60FPS Hardware-Accelerated Canvas (poster + cinematic overlays) */}
      <canvas
        ref={canvasRef}
        id="vbt-canvas-viewport"
        onClick={handleCanvasClick}
        className="w-full h-full object-cover cursor-grab active:cursor-grabbing relative z-10"
      />

      {/* Preloading Buffer Shimmer */}
      {!isBufferReady && (
        <div className="absolute inset-0 z-40 bg-[#090a0f]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 sm:p-8 transition-opacity duration-500">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-[#c5a880]/20 animate-ping opacity-30"></div>
            <div className="absolute inset-0 rounded-full border-2 border-t-[#c5a880] border-r-transparent border-b-[#c5a880]/40 border-l-transparent animate-spin"></div>
            <div className="absolute inset-2.5 rounded-full bg-[#12141d] flex items-center justify-center border border-[#c5a880]/30 shadow-inner">
              <span className="font-display text-[11px] sm:text-xs tracking-widest text-[#c5a880] font-bold">
                {bufferProgress}%
              </span>
            </div>
          </div>
          <h3 className="font-display text-sm sm:text-base tracking-[0.2em] uppercase text-white mb-1">
            VibeTour Pro Engine
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 font-light tracking-wide text-center mb-3 max-w-xs sm:max-w-md">
            Preparing cinematic room sequences &amp; material shaders...
          </p>
          <div className="w-48 sm:w-56 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-[#c5a880] transition-all duration-200 rounded-full"
              style={{ width: `${bufferProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Floating Header (Responsive Mobile & Desktop) */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="vbt-glass px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl flex items-center gap-2.5 pointer-events-auto border border-white/10 shadow-xl max-w-[65%] sm:max-w-none">
          <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#c5a880] animate-pulse shrink-0" />
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-display text-xs sm:text-sm font-semibold tracking-wider text-white truncate">
                {isFa && property.titleFa ? property.titleFa : property.title}
              </span>
              <span className="hidden sm:inline text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-[#c5a880]/15 text-[#c5a880] border border-[#c5a880]/30 font-bold">
                {property.price}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-light tracking-wide truncate">
              {isFa && property.subtitleFa ? property.subtitleFa : property.subtitle}
            </p>
          </div>
        </div>

        {/* Top Right Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Materials & Finishes Button */}
          <button
            onClick={() => {
              if (activeRoom.materials && activeRoom.materials.length > 0 && !selectedMaterial) {
                setSelectedMaterial(activeRoom.materials[0]);
              }
              setShowMaterialsDrawer(!showMaterialsDrawer);
            }}
            className={`vbt-glass px-3 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg ${
              showMaterialsDrawer 
                ? 'bg-[#c5a880] text-black font-semibold' 
                : 'text-[#e6d5bd] hover:text-white hover:border-[#c5a880]/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#c5a880]" />
            <span className="hidden sm:inline">
              Materials
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={isMuted ? 'Enable Sound' : 'Mute Sound'}
            className="vbt-glass p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-[#c5a880] hover:border-[#c5a880]/40 transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#c5a880]" />}
          </button>

          {/* Autoplay Toggle */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause' : 'Play'}
            className="vbt-glass p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-[#c5a880] hover:border-[#c5a880]/40 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#c5a880]" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Fullscreen"
            className="vbt-glass p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-[#c5a880] hover:border-[#c5a880]/40 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Admin-Only Controls: Scroll Speed and Elementor Studio */}
          {isAdmin && (
            <>
              {/* Scroll Speed Adjustment Controller (Admin Only) */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedPanel(!showSpeedPanel)}
                  title='Adjust Scroll Speed (Admin Only)'
                  className={`vbt-glass px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg ${
                    showSpeedPanel 
                      ? 'bg-[#c5a880] text-black font-semibold' 
                      : 'text-[#e6d5bd] hover:text-white hover:border-[#c5a880]/40'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5 text-[#c5a880]" />
                  <span className="font-mono text-[11px] font-bold">
                    {scrollSpeed.toFixed(1)}x
                  </span>
                </button>

                {/* Speed Floating Control Panel */}
                {showSpeedPanel && (
                  <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-64 p-3.5 rounded-2xl vbt-glass-gold shadow-2xl border border-[#c5a880]/40 z-50 animate-in fade-in zoom-in-95 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-1.5">
                        <Gauge className="w-4 h-4 text-[#c5a880]" />
                        <span className="text-xs font-bold text-white">
                          Scroll Speed Control (Admin)
                        </span>
                      </div>
                      <button 
                        onClick={() => setShowSpeedPanel(false)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Preset Speed Buttons */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-300 block">
                        Speed Presets:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { val: 0.25, label: '0.25x Slow' },
                          { val: 0.5, label: '0.50x Cinematic' },
                          { val: 1.0, label: '1.00x Standard' },
                          { val: 2.0, label: '2.00x Fast' },
                        ].map((item) => (
                          <button
                            key={item.val}
                            onClick={() => {
                              setScrollSpeed(item.val);
                              soundEngine.triggerHapticChime(500);
                            }}
                            className={`px-2 py-1.5 rounded-xl text-[10px] font-medium transition-all text-center ${
                              Math.abs(scrollSpeed - item.val) < 0.05
                                ? 'bg-[#c5a880] text-black font-bold shadow'
                                : 'bg-white/5 hover:bg-white/15 text-slate-200'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fine Tuning Slider */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Fine Tuning:</span>
                        <span className="font-mono text-[#c5a880] font-bold">{scrollSpeed.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.5"
                        step="0.05"
                        value={scrollSpeed}
                        onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                        className="w-full accent-[#c5a880] cursor-pointer h-1.5"
                      />
                    </div>

                    {/* Checkpoint Gates Toggle */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DoorOpen className="w-3.5 h-3.5 text-[#c5a880]" />
                        <span className="text-[10px] text-slate-200">
                          Auto Checkpoint Gates
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setEnableGates(!enableGates);
                          soundEngine.triggerHapticChime(550);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                          enableGates 
                            ? 'bg-[#c5a880]/20 text-[#c5a880] border border-[#c5a880]/40' 
                            : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {enableGates ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Elementor Studio (Admin Only) */}
              {onOpenCustomizer && (
                <button
                  onClick={onOpenCustomizer}
                  title='Open Elementor Studio (Admin Only)'
                  className="vbt-glass-gold px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium text-[#e6d5bd] flex items-center gap-1 hover:scale-105 transition-transform shadow-lg"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#c5a880]" />
                  <span className="hidden md:inline">
                    Elementor
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating "Return to Great Room Hub" */}
      {isPastEntrance && !isAtHub && (
        <div className="absolute top-28 sm:top-20 left-1/2 -translate-x-1/2 z-30 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={returnToHub}
            className="vbt-glass-gold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#e6d5bd] hover:bg-[#c5a880]/25 transition-all shadow-2xl border border-[#c5a880]/50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#c5a880]" />
            <span>
              Return to Great Room Hub
            </span>
          </button>
        </div>
      )}

      {/* GSAP Cinematic Room Title — reveal on room change (keyframe-free scroll layer) */}
      <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div
          ref={setRoomTitleEl}
          className="opacity-0 px-4 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-[#c5a880]/25"
        >
          <span className="font-display text-[11px] sm:text-sm font-bold tracking-[0.18em] uppercase text-[#e6d5bd]">
            {isFa && activeRoom.shortNameFa ? activeRoom.shortNameFa : activeRoom.shortName || activeRoom.name}
          </span>
        </div>
      </div>

      {/* Decision Gate Modal: Strict Pause Gate & Room Entrance Menu */}
      {activeGateRoom && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="max-w-4xl w-full vbt-glass-gold p-5 sm:p-8 rounded-3xl border border-[#c5a880]/50 shadow-2xl relative space-y-4 sm:space-y-6 max-h-[92vh] overflow-y-auto">
            
            {/* Top Gate Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#c5a880]/20 border border-[#c5a880]/40 text-[#c5a880] text-[11px] font-mono font-bold uppercase tracking-wider animate-pulse">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  Decision Gate • Scroll Paused
                </span>
              </div>

              <h2 className="font-display text-lg sm:text-2xl font-bold text-white tracking-wide">
                {isFa && activeGateRoom.pauseGateTitleFa
                  ? activeGateRoom.pauseGateTitleFa
                  : activeGateRoom.pauseGateTitle || 'Reached Checkpoint: Choose Next Chamber to Explore'}
              </h2>

              <p className="text-[11px] sm:text-xs text-slate-300 max-w-xl mx-auto font-light leading-relaxed">
                Scroll is paused at this checkpoint. Select any sanctuary below to enter its video walkthrough, or unlock scroll to continue in this space.
              </p>
            </div>

            {/* Grid of Other Chambers to Enter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {property.rooms
                .filter((r) => r.id !== activeGateRoom.id)
                .map((room, idx) => (
                  <div
                    key={room.id}
                    onClick={() => {
                      jumpToRoom(room, true);
                    }}
                    className="group relative p-3 sm:p-3.5 rounded-2xl bg-[#141622]/90 hover:bg-[#1f2235] border border-white/10 hover:border-[#c5a880] transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-lg hover:scale-[1.02] hover:shadow-[#c5a880]/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-white/15 group-hover:border-[#c5a880]/70 transition-colors">
                        <img
                          src={room.thumbnailUrl}
                          alt={room.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute bottom-1 right-1 text-[9px] font-mono text-[#c5a880] font-bold px-1 bg-black/60 rounded">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="overflow-hidden flex-1">
                        <div className="flex items-center gap-1.5">
                          {renderRoomIcon(room.icon, 'w-3.5 h-3.5 text-[#c5a880] shrink-0')}
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#c5a880] transition-colors truncate">
                            {isFa && room.nameFa ? room.nameFa : room.name}
                          </h4>
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 line-clamp-2 font-light">
                          {isFa && room.subtitleFa ? room.subtitleFa : room.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/10 text-slate-300">
                      <span className="flex items-center gap-1 text-[#c5a880]">
                        <Sparkles className="w-3 h-3" />
                        <span>{room.materials?.length || 2} Materials</span>
                      </span>
                      <span className="flex items-center gap-1 font-semibold group-hover:text-[#c5a880] transition-colors">
                        <span>Enter Chamber</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Bottom Footer Actions: Unlock & Continue or Adjust */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={unlockCurrentGateAndContinue}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all border border-white/20 hover:border-white/40 shadow-lg"
              >
                <Unlock className="w-4 h-4 text-[#c5a880]" />
                <span>
                  Continue In Current Room &amp; Unlock Scroll
                </span>
              </button>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="hidden sm:inline">
                  You can scroll backward to look back.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grand Living Hub Menu Overlay */}
      {showHubModal && (
        <div className="absolute inset-0 z-[35] bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="max-w-4xl w-full vbt-glass-gold p-5 sm:p-8 rounded-3xl border border-[#c5a880]/40 shadow-2xl relative space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowHubModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] sm:text-[11px] uppercase font-mono tracking-[0.2em] text-[#c5a880] font-bold">
                Great Room Hub
              </span>
              <h2 className="font-display text-lg sm:text-2xl font-bold text-white">
                Select a Chamber to Explore the Video Walkthrough
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 max-w-lg mx-auto font-light">
                Select any space below to transition and scrub through its cinematic walkthrough.
              </p>
            </div>

            {/* Chamber Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {property.rooms.filter((r) => !r.isHub).map((room, idx) => (
                <div
                  key={room.id}
                  onClick={() => jumpToRoom(room, true)}
                  className="group relative p-3 rounded-2xl bg-[#141622]/90 hover:bg-[#1f2235] border border-white/10 hover:border-[#c5a880] transition-all cursor-pointer flex flex-col justify-between gap-2.5 shadow-lg hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={room.thumbnailUrl} 
                      alt={room.name} 
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-white/10 group-hover:border-[#c5a880]/60 transition-colors shrink-0"
                    />
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#c5a880]">{String(idx + 1).padStart(2, '0')}</span>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#c5a880] transition-colors truncate">
                          {isFa && room.nameFa ? room.nameFa : room.name}
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {isFa && room.subtitleFa ? room.subtitleFa : room.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/10 text-slate-400">
                    <span className="flex items-center gap-1 text-[#c5a880]">
                      <Sparkles className="w-3 h-3" />
                      <span>{room.materials?.length || 2} Materials</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-300 group-hover:text-white">
                      <span>Enter Chamber</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Materials & Finishes Explorer Drawer */}
      {showMaterialsDrawer && activeRoom.materials && (
        <div className="absolute inset-y-0 right-0 sm:w-[420px] w-full max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[82vh] max-sm:rounded-t-3xl z-40 bg-[#0c0e15]/98 sm:backdrop-blur-2xl border-t sm:border-t-0 sm:border-l border-white/15 p-5 sm:p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right max-sm:slide-in-from-bottom duration-300">
          <div className="space-y-4 overflow-y-auto pr-1">
            
            {/* Mobile Sheet Grab Handle */}
            <div className="sm:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#c5a880]" />
                <h3 className="font-display text-sm font-bold text-white">
                  Architectural Materials
                </h3>
              </div>
              <button
                onClick={() => setShowMaterialsDrawer(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Chamber Subhead */}
            <div className="bg-[#141622] p-3 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">
                  Current Chamber
                </span>
                <span className="text-xs font-bold text-white">
                  {isFa && activeRoom.nameFa ? activeRoom.nameFa : activeRoom.name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#c5a880] px-2 py-0.5 rounded bg-[#c5a880]/15">
                {activeRoom.materials.length} Items
              </span>
            </div>

            {/* Material Swatch Selector */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Select Material Swatch:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {activeRoom.materials.map((mat) => {
                  const isSel = selectedMaterial?.id === mat.id;
                  return (
                    <div
                      key={mat.id}
                      onClick={() => setSelectedMaterial(mat)}
                      className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                        isSel 
                          ? 'bg-[#c5a880]/20 border-[#c5a880] shadow-md' 
                          : 'bg-[#141622]/80 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img 
                        src={mat.swatchUrl} 
                        alt={mat.name} 
                        className="w-8 h-8 rounded-lg object-cover border border-white/10 flex-shrink-0"
                      />
                      <div className="overflow-hidden">
                        <h5 className="text-[10px] sm:text-[11px] font-bold text-white truncate">
                          {isFa && mat.nameFa ? mat.nameFa : mat.name}
                        </h5>
                        <p className="text-[9px] text-[#c5a880] truncate">
                          {mat.category}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Material Detailed Card */}
            {selectedMaterial && (
              <div className="vbt-glass-gold p-3.5 sm:p-4 rounded-2xl space-y-3 border border-[#c5a880]/30 shadow-xl">
                <div className="relative h-28 sm:h-32 rounded-xl overflow-hidden border border-white/10">
                  <img 
                    src={selectedMaterial.swatchUrl} 
                    alt={selectedMaterial.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5 sm:p-3">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#c5a880] bg-black/60 px-2 py-0.5 rounded">
                        {selectedMaterial.category}
                      </span>
                      <h4 className="font-display text-xs sm:text-sm font-bold text-white mt-1">
                        {isFa && selectedMaterial.nameFa ? selectedMaterial.nameFa : selectedMaterial.name}
                      </h4>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] sm:text-xs text-slate-300 font-light leading-relaxed">
                  {isFa && selectedMaterial.descriptionFa ? selectedMaterial.descriptionFa : selectedMaterial.description}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-white/10 text-[10px] sm:text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Origin:</span>
                    <span className="font-medium text-white">{selectedMaterial.origin}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Finish:</span>
                    <span className="font-medium text-[#c5a880]">{selectedMaterial.finish}</span>
                  </div>
                  {selectedMaterial.spec && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Specification:</span>
                      <span className="font-mono text-white">{selectedMaterial.spec}</span>
                    </div>
                  )}
                  {selectedMaterial.ecoCert && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Eco Certification:</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{selectedMaterial.ecoCert}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10">
            <button
              onClick={() => setShowMaterialsDrawer(false)}
              className="w-full py-2.5 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-semibold text-xs transition-all shadow-lg"
            >
              Close &amp; Continue Tour
            </button>
          </div>
        </div>
      )}

      {/* Hotspot Detailed Popover */}
      {selectedHotspot && (
        <div className="absolute bottom-24 sm:bottom-28 left-4 sm:left-6 right-4 sm:right-auto z-30 max-w-sm vbt-glass-gold p-4 rounded-2xl animate-in fade-in zoom-in-95 duration-150 shadow-2xl border border-[#c5a880]/40">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-[#c5a880]/20 text-[#c5a880] border border-[#c5a880]/40 font-bold">
                {selectedHotspot.category} Highlight
              </span>
              <h4 className="font-display text-xs sm:text-base font-bold text-white mt-1">
                {isFa && selectedHotspot.titleFa ? selectedHotspot.titleFa : selectedHotspot.title}
              </h4>
            </div>
            <button 
              onClick={() => setSelectedHotspot(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-300 font-light leading-relaxed mb-2">
            {isFa && selectedHotspot.descriptionFa ? selectedHotspot.descriptionFa : selectedHotspot.description}
          </p>
          {selectedHotspot.spec && (
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] pt-1.5 border-t border-white/10 text-slate-400">
              <span>Specification:</span>
              <span className="font-medium text-white">{selectedHotspot.spec}</span>
            </div>
          )}
          {selectedHotspot.priceTag && (
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] pt-1 text-[#c5a880]">
              <span>Valuation:</span>
              <span className="font-semibold">{selectedHotspot.priceTag}</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Luxury Navigation Hub (Chamber Tabs & Scrub Timeline) */}
      <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-4 right-3 sm:right-4 z-30 flex flex-col items-center pointer-events-none">
        {/* Chamber Tabs */}
        <div 
          id="vbt-luxury-hub-nav"
          className="vbt-glass px-2 py-1.5 rounded-xl sm:rounded-2xl flex items-center gap-1 sm:gap-2 max-w-full overflow-x-auto no-scrollbar touch-pan-x shadow-2xl border border-white/10 pointer-events-auto"
          style={{
            backdropFilter: `blur(${config.glassBlur}px)`,
            backgroundColor: `rgba(18, 20, 29, 0.78)`
          }}
        >
          {property.rooms.map((room) => {
            const isCurrent = activeRoom.id === room.id;
            return (
              <button
                key={room.id}
                id={`vbt-room-tab-${room.id}`}
                onClick={() => jumpToRoom(room, true)}
                className={`relative px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all duration-150 active:scale-95 ${
                  isCurrent 
                    ? 'bg-[#c5a880] text-black font-bold shadow-lg shadow-[#c5a880]/30' 
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                {renderRoomIcon(room.icon, isCurrent ? 'w-3 h-3 sm:w-3.5 sm:h-3.5 text-black' : 'w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#c5a880]')}
                <span className="tracking-wide">
                  {isFa && room.shortNameFa ? room.shortNameFa : room.shortName}
                </span>
                {isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black ml-0.5 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Scrub Timeline Bar */}
        <div className="w-full max-w-xl mt-2 sm:mt-3 px-2 sm:px-4 flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] text-slate-400 font-mono pointer-events-auto">
          <span ref={timeDisplayRef}>00:00</span>
          <div 
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              // Release lock if jumping directly via timeline
              isGateLockedRef.current = false;
              activeGateProgressRef.current = null;
              setActiveGateRoom(null);
              targetProgressRef.current = clickPct;
              progressRef.current = clickPct;
              soundEngine.triggerHapticChime(500);
            }}
            className="flex-1 h-2 sm:h-2.5 bg-white/15 hover:h-3 rounded-full cursor-pointer overflow-hidden relative transition-all shadow-inner"
          >
            <div 
              ref={progressBarRef}
              className="h-full bg-gradient-to-r from-[#8c6d46] via-[#c5a880] to-[#e6d5bd] rounded-full"
              style={{ width: '0%' }}
            />
            {property.rooms.map((r) => {
              const gateFactor = r.enablePauseGate ? (r.pauseCheckpointProgress ?? 0.85) : null;
              const gateGlobal = gateFactor !== null ? r.startProgress + (r.endProgress - r.startProgress) * gateFactor : null;
              return (
                <React.Fragment key={r.id}>
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white/40 pointer-events-none"
                    style={{ left: `${r.startProgress * 100}%` }}
                    title={r.name}
                  />
                  {gateGlobal !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-amber-400 pointer-events-none z-10 shadow-[0_0_6px_rgba(251,191,36,0.9)]"
                      style={{ left: `${gateGlobal * 100}%` }}
                      title={`Auto Checkpoint: ${r.name}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <span className="whitespace-nowrap text-[#c5a880] font-bold">
            {String(currentChamberNumber).padStart(2, '0')}/{String(property.rooms.length).padStart(2, '0')}
          </span>
          <span className="hidden sm:inline text-slate-500">• {fps} FPS</span>
        </div>
      </div>

      {/* Start Tour Initial Cue */}
      {showStartCue && (
        <div className="absolute bottom-20 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 animate-bounce">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-display text-[#c5a880] bg-black/80 px-3.5 py-1 rounded-full border border-[#c5a880]/30 backdrop-blur-md font-semibold">
            Scroll or swipe slowly to enter the estate
          </span>
        </div>
      )}
    </div>
  );
};
