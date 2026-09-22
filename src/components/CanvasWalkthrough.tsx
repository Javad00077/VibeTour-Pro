import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  ChevronRight, 
  ChevronLeft,
  X,
  Sliders,
  Layers,
  Globe,
  Info,
  ArrowRight,
  ShieldCheck,
  Check,
  Hand,
  Gauge,
  Lock,
  Unlock,
  DoorOpen
} from 'lucide-react';
import { PropertyListing, Room, Hotspot, MaterialItem, PluginConfig } from '../types';
import { soundEngine } from '../utils/audioSynth';

interface CanvasWalkthroughProps {
  property: PropertyListing;
  config: PluginConfig;
  activeRoomId?: string;
  onSelectRoom?: (roomId: string) => void;
  onOpenCustomizer?: () => void;
  isAdmin?: boolean;
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
  const videoElementsRef = useRef<Map<string, { video: HTMLVideoElement; url: string }>>(new Map());
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const directVideoDomRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const depthDisplayRef = useRef<HTMLSpanElement | null>(null);
  
  // Kinetic scrubbing mutable refs
  const progressRef = useRef<number>(0);
  const targetProgressRef = useRef<number>(0);
  const activeRoomIndexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const startDragYRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  
  // React State
  const [activeRoom, setActiveRoom] = useState<Room>(property.rooms[0] || {} as Room);
  const [bufferProgress, setBufferProgress] = useState<number>(30);
  const [isBufferReady, setIsBufferReady] = useState<boolean>(false);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHubModal, setShowHubModal] = useState<boolean>(false);
  const [showMaterialsDrawer, setShowMaterialsDrawer] = useState<boolean>(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [lang, setLang] = useState<'fa' | 'en'>(config.language || 'fa');
  const [fps, setFps] = useState<number>(60);
  const [hoveredBeacon, setHoveredBeacon] = useState<string | null>(null);
  const isFa = lang === 'fa';

  // Scroll Speed Adjustment
  const [scrollSpeed, setScrollSpeed] = useState<number>(config.scrollSpeedFactor || 0.5);
  const scrollSpeedRef = useRef<number>(config.scrollSpeedFactor || 0.5);
  const [showSpeedPanel, setShowSpeedPanel] = useState<boolean>(false);
  const [enableGates, setEnableGates] = useState<boolean>(config.enableGlobalCheckpointGates !== false);

  // Checkpoint Decision Gates & Strict Scroll Lock
  const [activeGateRoom, setActiveGateRoom] = useState<Room | null>(null);
  const isGateLockedRef = useRef<boolean>(false);
  const activeGateProgressRef = useRef<number | null>(null);
  const dismissedGatesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    scrollSpeedRef.current = scrollSpeed;
  }, [scrollSpeed]);

  useEffect(() => {
    if (config.scrollSpeedFactor) {
      setScrollSpeed(config.scrollSpeedFactor);
      scrollSpeedRef.current = config.scrollSpeedFactor;
    }
  }, [config.scrollSpeedFactor]);

  useEffect(() => {
    if (config.enableGlobalCheckpointGates !== undefined) {
      setEnableGates(config.enableGlobalCheckpointGates);
    }
  }, [config.enableGlobalCheckpointGates]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (directVideoDomRef.current && activeRoom.videoUrl) {
      if (directVideoDomRef.current.src !== activeRoom.videoUrl) {
        directVideoDomRef.current.src = activeRoom.videoUrl;
        directVideoDomRef.current.load();
      }
    }
  }, [activeRoom.videoUrl]);

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
    return { room: rooms[0], index: 0 };
  }, [property.rooms]);

  // Preload and sync Images & Videos whenever property.rooms or their videoUrl/mediaUrl change
  useEffect(() => {
    setIsBufferReady(false);
    setBufferProgress(15);
    let loadedCount = 0;
    const total = property.rooms.length;

    property.rooms.forEach((room) => {
      // 1. Sync or Create Image
      let img = imageCacheRef.current.get(room.id);
      if (!img || img.src !== room.mediaUrl) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = room.mediaUrl;
        
        const onDone = () => {
          if (img) imageCacheRef.current.set(room.id, img);
          loadedCount++;
          const pct = Math.round((loadedCount / total) * 100);
          setBufferProgress(pct);
          if (pct >= 20) {
            setIsBufferReady(true);
          }
        };

        if (img.decode) {
          img.decode().then(onDone).catch(onDone);
        } else {
          img.onload = onDone;
          img.onerror = onDone;
        }
      }

      // 2. Sync or Create Video element if videoUrl is present
      if (room.videoUrl) {
        const existing = videoElementsRef.current.get(room.id);
        if (!existing || existing.url !== room.videoUrl) {
          const video = document.createElement('video');
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'auto';

          let hasRetriedNoCors = false;
          video.onerror = () => {
            if (!hasRetriedNoCors) {
              hasRetriedNoCors = true;
              // Strip crossOrigin to prevent CORS rejection on hosts without headers
              video.removeAttribute('crossorigin');
              (video as any).crossOrigin = null;
              video.src = room.videoUrl!;
              video.load();
            }
          };

          try {
            video.crossOrigin = 'anonymous';
          } catch {
            // safe
          }
          video.src = room.videoUrl;
          video.load();
          videoElementsRef.current.set(room.id, { video, url: room.videoUrl });
        }
      } else {
        videoElementsRef.current.delete(room.id);
      }
    });

    const timer = setTimeout(() => {
      setIsBufferReady(true);
      setBufferProgress(100);
    }, 300);

    return () => clearTimeout(timer);
  }, [property.rooms]);

  // Jump to activeRoomId if changed externally
  useEffect(() => {
    if (activeRoomId) {
      const found = property.rooms.find((r) => r.id === activeRoomId);
      if (found) {
        jumpToRoom(found, true);
      }
    }
  }, [activeRoomId, property.rooms]);

  // Jump to specific room
  const jumpToRoom = (room: Room, immediate: boolean = true) => {
    if (!room) return;
    // Release any checkpoint gate lock
    isGateLockedRef.current = false;
    activeGateProgressRef.current = null;
    setActiveGateRoom(null);

    const roomRange = Math.max(0.01, room.endProgress - room.startProgress);
    const startOfRoom = room.startProgress + roomRange * 0.05;
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

  // Return to Living Hub (Chamber 3)
  const returnToHub = () => {
    const hubRoom = property.rooms.find((r) => r.isHub) || property.rooms[2] || property.rooms[0];
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

  // Wheel listener with configurable scroll speed and strict checkpoint locking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const speedFactor = scrollSpeedRef.current;
      const sensitivity = (0.0008 * speedFactor) / Math.max(0.6, config.scrubSmoothing * 0.7);
      const delta = e.deltaY * sensitivity;

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
            isGateLockedRef.current = true;
            activeGateProgressRef.current = gateGlobalProgress;
            setActiveGateRoom(currRoom);
            setIsPlaying(false);
            soundEngine.triggerHapticChime(580);
          }
        }
      }

      targetProgressRef.current = nextProg;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (isGateLockedRef.current) return;
        let nextProg = Math.min(1, targetProgressRef.current + 0.03);
        if (enableGates) {
          const { room: currRoom } = getRoomByProgress(nextProg);
          if (currRoom && currRoom.enablePauseGate && !dismissedGatesRef.current.has(currRoom.id)) {
            const gateFactor = currRoom.pauseCheckpointProgress ?? 0.85;
            const roomRange = currRoom.endProgress - currRoom.startProgress;
            const gateGlobalProgress = currRoom.startProgress + roomRange * gateFactor;
            if (nextProg >= gateGlobalProgress) {
              nextProg = gateGlobalProgress;
              isGateLockedRef.current = true;
              activeGateProgressRef.current = gateGlobalProgress;
              setActiveGateRoom(currRoom);
              setIsPlaying(false);
              soundEngine.triggerHapticChime(580);
            }
          }
        }
        targetProgressRef.current = nextProg;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        targetProgressRef.current = Math.max(0, targetProgressRef.current - 0.03);
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
  }, [config.scrubSmoothing, enableGates, getRoomByProgress]);

  // Main 60FPS Render Loop
  useEffect(() => {
    let frameCount = 0;
    let fpsTimer = performance.now();
    let lastRoomId = property.rooms[0]?.id;

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

      // Autoplay
      if (isPlayingRef.current) {
        const speed = 0.001 * config.autoplaySpeed;
        targetProgressRef.current += speed;
        if (targetProgressRef.current > 1.0) {
          targetProgressRef.current = 0;
        }
      }

      // Smooth inertia
      const diff = targetProgressRef.current - progressRef.current;
      const smoothRate = Math.min(1, dt * 10.0 / Math.max(0.8, config.scrubSmoothing));
      progressRef.current += diff * smoothRate;

      if (progressRef.current < 0) progressRef.current = 0;
      if (progressRef.current > 1) progressRef.current = 1;

      const currentProg = progressRef.current;

      // Update DOM progress bar & timers directly
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${(currentProg * 100).toFixed(2)}%`;
      }
      if (timeDisplayRef.current) {
        const secs = Math.round(currentProg * 60);
        timeDisplayRef.current.textContent = `00:${String(secs).padStart(2, '0')}`;
      }
      if (depthDisplayRef.current) {
        depthDisplayRef.current.textContent = `${Math.round(currentProg * 100)}% TOUR DEPTH`;
      }

      // Check current room
      const { room: currRoom, index: currRoomIdx } = getRoomByProgress(currentProg);

      if (currRoom && currRoom.id !== lastRoomId) {
        lastRoomId = currRoom.id;
        activeRoomIndexRef.current = currRoomIdx;
        setActiveRoom(currRoom);
        soundEngine.triggerHapticChime(480);
      }

      // Canvas Rendering
      const canvas = canvasRef.current;
      if (canvas && currRoom) {
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          const roomRange = Math.max(0.01, currRoom.endProgress - currRoom.startProgress);
          const localProg = Math.max(0, Math.min(1, (currentProg - currRoom.startProgress) / roomRange));

          // 1. VIDEO ROOM RENDERING (Direct GPU-Hardware Accelerated, Zero-Flicker)
          if (currRoom.videoUrl) {
            const vid = directVideoDomRef.current;
            if (vid) {
              if (vid.src !== currRoom.videoUrl) {
                vid.src = currRoom.videoUrl;
                vid.load();
              }
              if (vid.duration && !Number.isNaN(vid.duration)) {
                const targetTime = localProg * vid.duration;
                // Scrub smoothly without dropped frames
                if (Math.abs(vid.currentTime - targetTime) > 0.03) {
                  vid.currentTime = targetTime;
                }
              }
            }
            // Clear canvas transparently so background video shows through with ZERO black frames
            ctx.clearRect(0, 0, width, height);
          } else {
            // 2. STATIC IMAGE ROOM RENDERING
            const img = imageCacheRef.current.get(currRoom.id);
            ctx.fillStyle = '#090a0f';
            ctx.fillRect(0, 0, width, height);

            if (img && img.complete && img.naturalWidth > 0) {
              const zoom = 1.0 + localProg * 0.12;
              const panX = Math.sin(localProg * Math.PI) * (width * 0.03);
              const panY = (localProg - 0.5) * (height * 0.02);

              ctx.save();
              ctx.translate(width / 2 + panX, height / 2 + panY);
              ctx.scale(zoom, zoom);
              ctx.translate(-width / 2, -height / 2);

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
              ctx.restore();
            }
          }

          // Luxury Cinematic Grading & Vignette
          const grad = ctx.createRadialGradient(
            width / 2, height / 2, width * 0.22,
            width / 2, height / 2, width * 0.78
          );
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(9, 10, 15, 0.65)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          // Sunlight Shimmer
          const flareX = width * (0.85 - localProg * 0.2);
          const sunGlow = ctx.createRadialGradient(flareX, height * 0.2, 0, flareX, height * 0.2, width * 0.35);
          sunGlow.addColorStop(0, 'rgba(230, 213, 189, 0.16)');
          sunGlow.addColorStop(0.5, 'rgba(197, 168, 128, 0.05)');
          sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = sunGlow;
          ctx.fillRect(0, 0, width, height);

          // 1. Render Interactive Material Beacons (نقاط انتخاب متریال با کلیک و مشاهده توضیحات)
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
  }, [property.rooms, config, getRoomByProgress, isFa]);

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
    isDraggingRef.current = true;
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
    const speedFactor = scrollSpeedRef.current;
    const dragSens = 0.0016 * speedFactor;
    const delta = deltaY * dragSens;

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
          isGateLockedRef.current = true;
          activeGateProgressRef.current = gateGlobalProgress;
          setActiveGateRoom(currRoom);
          setIsPlaying(false);
          soundEngine.triggerHapticChime(580);
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

  const isPastEntrance = progressRef.current > 0.32;
  const isAtHub = activeRoom.isHub;

  return (
    <div 
      ref={containerRef}
      id="vbt-tour-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      tabIndex={0}
      dir={isFa ? 'rtl' : 'ltr'}
      className={`relative w-full overflow-hidden select-none bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center outline-none touch-none ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[68vh] sm:h-[78vh] min-h-[520px] max-h-[860px] rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl shadow-black/90'
      }`}
    >
      {/* Direct Hardware Video Element Layer */}
      <video
        ref={directVideoDomRef}
        muted
        playsInline
        loop
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
          activeRoom.videoUrl ? 'opacity-100 z-0' : 'opacity-0 -z-10 hidden'
        }`}
      />

      {/* 60FPS Hardware-Accelerated Canvas */}
      <canvas
        ref={canvasRef}
        id="vbt-canvas-viewport"
        onClick={handleCanvasClick}
        className={`w-full h-full object-cover cursor-grab active:cursor-grabbing relative z-10 ${
          activeRoom.videoUrl ? 'bg-transparent' : ''
        }`}
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
            {isFa ? 'موتور پردازشگر تور مجازی' : 'VibeTour Pro Engine'}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 font-light tracking-wide text-center mb-3 max-w-xs sm:max-w-md">
            {isFa 
              ? 'در حال آماده‌سازی ویدیوهای اختصاصی، فریم‌های ۶۰ فریم و متریال‌ها...' 
              : 'Buffering cinematic room sequences & material shaders...'}
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
          {/* Language Switcher */}
          <button
            onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
            title="Switch Language / تغییر زبان"
            className="vbt-glass px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs text-slate-200 hover:text-[#c5a880] hover:border-[#c5a880]/40 transition-colors flex items-center gap-1 font-medium"
          >
            <Globe className="w-3.5 h-3.5 text-[#c5a880]" />
            <span className="text-[11px]">{lang === 'fa' ? 'EN' : 'فا'}</span>
          </button>

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
              {isFa ? 'متریال‌ها و مصالح' : 'Materials'}
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
                  title={isFa ? 'تنظیم سرعت اسکرول و پیمایش (مخصوص مدیر)' : 'Adjust Scroll Speed (Admin Only)'}
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
                          {isFa ? 'تنظیم سرعت اسکرول (مدیر)' : 'Scroll Speed Control (Admin)'}
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
                        {isFa ? 'حالت‌های پیش‌فرض:' : 'Speed Presets:'}
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { val: 0.25, labelFa: '۰.۲۵x اسلوموشن', labelEn: '0.25x Ultra Slow' },
                          { val: 0.5, labelFa: '۰.۵x سینمایی (پیش‌فرض)', labelEn: '0.5x Cinematic' },
                          { val: 1.0, labelFa: '۱.۰x طبیعی', labelEn: '1.0x Standard' },
                          { val: 1.8, labelFa: '۱.۸x سریع', labelEn: '1.8x Fast' },
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
                            {isFa ? item.labelFa : item.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fine Tuning Slider */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">{isFa ? 'تنظیم دقیق:' : 'Fine Tuning:'}</span>
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
                          {isFa ? 'ایستگاه‌های توقف خودکار' : 'Auto Checkpoint Gates'}
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
                        {enableGates ? (isFa ? 'فعال' : 'ON') : (isFa ? 'غیرفعال' : 'OFF')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Elementor Studio (Admin Only) */}
              {onOpenCustomizer && (
                <button
                  onClick={onOpenCustomizer}
                  title="باز کردن استودیو المنتور (مخصوص مدیر)"
                  className="vbt-glass-gold px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium text-[#e6d5bd] flex items-center gap-1 hover:scale-105 transition-transform shadow-lg"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#c5a880]" />
                  <span className="hidden md:inline">
                    {isFa ? 'المنتور' : 'Elementor'}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating "Return to Grand Salon Hub" (دکمه بازگشت به پذیرایی اصلی) */}
      {isPastEntrance && !isAtHub && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-30 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={returnToHub}
            className="vbt-glass-gold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#e6d5bd] hover:bg-[#c5a880]/25 transition-all shadow-2xl border border-[#c5a880]/50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#c5a880]" />
            <span>
              {isFa ? 'بازگشت به مرکز پذیرایی' : 'Return to Grand Salon Hub'}
            </span>
          </button>
        </div>
      )}

      {/* Decision Gate Modal: Strict Pause Gate & Room Entrance Menu (ایستگاه توقف خودکار اسکرول و منوی ورود به اتاق‌ها) */}
      {activeGateRoom && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="max-w-4xl w-full vbt-glass-gold p-5 sm:p-8 rounded-3xl border border-[#c5a880]/50 shadow-2xl relative space-y-4 sm:space-y-6 max-h-[92vh] overflow-y-auto">
            
            {/* Top Gate Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#c5a880]/20 border border-[#c5a880]/40 text-[#c5a880] text-[11px] font-mono font-bold uppercase tracking-wider animate-pulse">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {isFa ? 'ایستگاه ناوبری هوشمند • اسکرول متوقف شد' : 'Decision Gate • Scroll Paused'}
                </span>
              </div>

              <h2 className="font-display text-lg sm:text-2xl font-bold text-white tracking-wide">
                {isFa && activeGateRoom.pauseGateTitleFa
                  ? activeGateRoom.pauseGateTitleFa
                  : activeGateRoom.pauseGateTitle || (isFa ? 'پایان مسیر این فضا؛ ورود به کدام اتاق را انتخاب می‌کنید؟' : 'Reached Checkpoint: Choose Next Chamber to Explore')}
              </h2>

              <p className="text-[11px] sm:text-xs text-slate-300 max-w-xl mx-auto font-light leading-relaxed">
                {isFa
                  ? 'حرکت اسکرول در این لحظه قفل شده است تا مسیر دلخواه بعدی خود را تعیین فرمایید. لطفاً یکی از فضاهای زیر را جهت ورود به ویدیوی آن انتخاب نمایید، یا برای ادامه گشت در همین فضا دکمه ادامه را بزنید.'
                  : 'Scroll is paused at this checkpoint. Select any sanctuary below to enter its video walkthrough, or unlock scroll to continue in this space.'}
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
                    className="group relative p-3 sm:p-3.5 rounded-2xl bg-[#141622]/90 hover:bg-[#1f2235] border border-white/10 hover:border-[#c5a880] transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-lg hover:scale-102 hover:shadow-[#c5a880]/20"
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
                          0{idx + 1}
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
                        <span>{room.materials?.length || 2} {isFa ? 'متریال لوکس' : 'Materials'}</span>
                      </span>
                      <span className="flex items-center gap-1 font-semibold group-hover:text-[#c5a880] transition-colors">
                        <span>{isFa ? 'ورود به این اتاق' : 'Enter Chamber'}</span>
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
                  {isFa ? 'ادامه حرکت در همین فضا و باز کردن اسکرول' : 'Continue In Current Room & Unlock Scroll'}
                </span>
              </button>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="hidden sm:inline">
                  {isFa ? 'برای تماشای مجدد عقب، می‌توانید به بالا اسکرول نمایید.' : 'You can scroll backward to look back.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grand Living Hub Menu Overlay (منوی جامع انتخاب اتاق‌ها در مرکز سالن پذیرایی) */}
      {(showHubModal || (isAtHub && progressRef.current > 0.35 && progressRef.current < 0.46)) && (
        <div className="absolute inset-0 z-35 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="max-w-4xl w-full vbt-glass-gold p-5 sm:p-8 rounded-3xl border border-[#c5a880]/40 shadow-2xl relative space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowHubModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] sm:text-[11px] uppercase font-mono tracking-[0.2em] text-[#c5a880] font-bold">
                {isFa ? 'مرکز ناوبری اختصاصی پنت‌هاوس' : 'Grand Living Salon Hub'}
              </span>
              <h2 className="font-display text-lg sm:text-2xl font-bold text-white">
                {isFa ? 'انتخاب فضا و اتاق برای تماشای ویدیوی اختصاصی' : 'Select a Chamber to Explore Video Walkthrough'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 max-w-lg mx-auto font-light">
                {isFa 
                  ? 'با انتخاب هر بخش، ویدیوی باکیفیت و متریال‌های اختصاصی آن فضا بارگذاری می‌شود و با اسکرول کنترل خواهد شد.'
                  : 'Select any sanctuary below to transition and scrub through its video walkthrough.'}
              </p>
            </div>

            {/* Chamber Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {property.rooms.filter((r) => !r.isHub).map((room, idx) => (
                <div
                  key={room.id}
                  onClick={() => jumpToRoom(room, true)}
                  className="group relative p-3 rounded-2xl bg-[#141622]/90 hover:bg-[#1f2235] border border-white/10 hover:border-[#c5a880] transition-all cursor-pointer flex flex-col justify-between gap-2.5 shadow-lg hover:scale-102"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={room.thumbnailUrl} 
                      alt={room.name} 
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-white/10 group-hover:border-[#c5a880]/60 transition-colors shrink-0"
                    />
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#c5a880]">0{idx + 1}</span>
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
                      <span>{room.materials?.length || 2} {isFa ? 'متریال لوکس' : 'Materials'}</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-300 group-hover:text-white">
                      <span>{isFa ? 'ورود به فضا' : 'Enter'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Materials & Finishes Explorer Drawer / Mobile Bottom Sheet (انتخاب و بررسی متریال‌های استفاده شده) */}
      {showMaterialsDrawer && activeRoom.materials && (
        <div className="absolute inset-y-0 right-0 sm:w-[420px] w-full max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[82vh] max-sm:rounded-t-3xl z-40 bg-[#0c0e15]/98 sm:backdrop-blur-2xl border-t sm:border-t-0 sm:border-l border-white/15 p-5 sm:p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right max-sm:slide-in-from-bottom duration-300">
          <div className="space-y-4 overflow-y-auto pr-1">
            
            {/* Mobile Sheet Grab Handle */}
            <div className="sm:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#c5a880]" />
                <h3 className="font-display text-sm font-bold text-white">
                  {isFa ? 'متریال‌ها و مصالح معماری' : 'Architectural Materials'}
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
                  {isFa ? 'فضای در حال نمایش' : 'Current Chamber'}
                </span>
                <span className="text-xs font-bold text-white">
                  {isFa && activeRoom.nameFa ? activeRoom.nameFa : activeRoom.name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#c5a880] px-2 py-0.5 rounded bg-[#c5a880]/15">
                {activeRoom.materials.length} {isFa ? 'متریال' : 'Items'}
              </span>
            </div>

            {/* Material Swatch Selector */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                {isFa ? 'انتخاب متریال جهت مشاهده جزییات:' : 'Select Material Swatch:'}
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
                    <span>{isFa ? 'خاستگاه و کشور مبدا:' : 'Origin:'}</span>
                    <span className="font-medium text-white">{selectedMaterial.origin}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>{isFa ? 'نوع فینیش و پرداخت:' : 'Finish:'}</span>
                    <span className="font-medium text-[#c5a880]">{selectedMaterial.finish}</span>
                  </div>
                  {selectedMaterial.spec && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>{isFa ? 'استاندارد فنی:' : 'Spec:'}</span>
                      <span className="font-mono text-white">{selectedMaterial.spec}</span>
                    </div>
                  )}
                  {selectedMaterial.ecoCert && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>{isFa ? 'گواهی زیست‌محیطی:' : 'Eco Cert:'}</span>
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
              {isFa ? 'بستن پنل و ادامه گشت‌وگذار' : 'Close & Continue Tour'}
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
                {selectedHotspot.category} {isFa ? 'نقطه کانونی' : 'Highlight'}
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
              <span>{isFa ? 'مشخصات فنی:' : 'Specification:'}</span>
              <span className="font-medium text-white">{selectedHotspot.spec}</span>
            </div>
          )}
          {selectedHotspot.priceTag && (
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] pt-1 text-[#c5a880]">
              <span>{isFa ? 'ارزش تخمینی:' : 'Valuation:'}</span>
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
          className="vbt-glass px-2 py-1.5 rounded-xl sm:rounded-2xl flex items-center gap-1 sm:gap-2 max-w-full overflow-x-auto shadow-2xl border border-white/10 pointer-events-auto"
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
              className="h-full bg-gradient-to-r from-[#8c6d46] via-[#c5a880] to-[#e6d5bd] rounded-full transition-all duration-75"
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
                      title={`ایستگاه توقف خودکار: ${r.name}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <span>01:00</span>
          <span className="hidden sm:inline text-slate-500">• {fps} FPS</span>
        </div>
      </div>

      {/* Start Tour Initial Cue */}
      {progressRef.current < 0.05 && (
        <div className="absolute bottom-20 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 animate-bounce">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-display text-[#c5a880] bg-black/80 px-3.5 py-1 rounded-full border border-[#c5a880]/30 backdrop-blur-md font-semibold">
            {isFa ? 'برای ورود به ساختمان، به آرامی اسکرول کنید' : 'Scroll slowly to enter through the main gates'}
          </span>
        </div>
      )}
    </div>
  );
};
