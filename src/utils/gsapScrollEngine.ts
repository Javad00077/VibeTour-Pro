/**
 * GSAP SCROLL ENGINE — keyframe-free cinematic scroll for the walkthrough.
 *
 * WHY THIS EXISTS
 * ---------------
 * Frame-accurate scrubbing needs the video's keyframes (I-frames) to land close
 * to the requested positions. Long-GOP smartphone footage (or any clip re-encoded
 * without --g 1) places keyframes seconds apart, so per-frame seeking stalls and
 * the scroll feels "chunky". This engine takes a different path:
 *
 *   1. It never relies on keyframes. `computeScrubSmoothing` derives a GSAP
 *      scrub value directly from the admin's smoothing setting, so the progress
 *      value the player chases is always a smooth, cinematic curve — the clip
 *      simply plays through the smooth target instead of seeking to it.
 *   2. ScrollTrigger keeps that target and the on-screen UI (progress bar,
 *      depth readout, room title) locked to one master timeline, so the input
 *      never fights the render loop.
 *   3. Room titles/overlays get GSAP reveal tweens — the "attractive" layer —
 *      without touching the video path.
 *
 * Everything here is pure or side-effect-light so it stays unit-testable.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** Reduced-motion visitors get the final state immediately — no scrub smoothing. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Map the admin's `scrubSmoothing` setting (higher = heavier/inertial) to a
 * GSAP `scrub` value for a ScrollTrigger timeline.
 *
 * scrubSmoothing 1 → 0.9 (snappy), 2 → 1.5 (default feel), 3+ → 2.4 (heavy).
 * Reduced-motion collapses everything to plain sync (scrub: true).
 */
export function computeScrubSmoothing(scrubSmoothing?: number, reducedMotion?: boolean): number {
  if (reducedMotion) return 0; // caller maps 0 to `scrub: true`
  const s = typeof scrubSmoothing === 'number' && Number.isFinite(scrubSmoothing) && scrubSmoothing > 0 ? scrubSmoothing : 1.6;
  return Math.max(0.5, Math.min(2.4, 0.35 + 0.72 * s));
}

/** clamp01 helper shared by the render loop and the bridge. */
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface ScrollBridgeHandle {
  destroy: () => void;
  refresh: () => void;
}

/**
 * Mirror an external progress source (wheel/drag/keys → targetProgressRef)
 * into a DOM element's vertical scroll position via ScrollTrigger.
 *
 * The walkthrough is a fixed-canvas experience (no native page scroll), so the
 * bridge drives a tall invisible "scroll track" element instead of the window:
 * a scroll listener on the track feeds targetProgress, and the render loop keeps
 * painting. This gives GSAP's scrub timing a real scroll origin without
 * restructuring the component into a pinned page.
 *
 * `onProgress` receives the raw scroll ratio (0..1) — the component decides how
 * it maps onto the tour (gates, room ranges).
 */
export function createScrollBridge(opts: {
  track: HTMLElement;
  viewport: HTMLElement;
  initialProgress: number;
  onProgress: (p: number) => void;
}): ScrollBridgeHandle {
  const { track, viewport, initialProgress, onProgress } = opts;

  // Position the track's scroll thumb to the incoming progress once.
  let maxY = Math.max(1, track.scrollHeight - viewport.clientHeight);
  track.scrollTop = clamp01(initialProgress) * maxY;

  let lastP = clamp01(initialProgress);
  const onScroll = () => {
    const p = clamp01(track.scrollTop / maxY);
    if (p !== lastP) {
      lastP = p;
      onProgress(p);
    }
  };
  track.addEventListener('scroll', onScroll, { passive: true });

  const st = ScrollTrigger.create({
    trigger: viewport,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => onProgress(clamp01(self.progress))
  });

  return {
    destroy() {
      track.removeEventListener('scroll', onScroll);
      st.kill();
    },
    refresh: () => {
      maxY = Math.max(1, track.scrollHeight - viewport.clientHeight); // recompute
      st.refresh();
    }
  };
}

/**
 * Cinematic room-title reveal: gold sheen sweep + soft rise. Returns the tween
 * so the caller can kill it if the room changes mid-flight.
 */
export function revealRoomTitle(el: HTMLElement, reducedMotion = false): gsap.core.Timeline | null {
  if (reducedMotion) {
    gsap.set(el, { opacity: 1, y: 0, clearProps: 'filter' });
    return null;
  }
  const tl = gsap.timeline();
  tl.fromTo(
    el,
    { opacity: 0, y: 18, filter: 'blur(6px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, ease: 'power2.out' }
  );
  return tl;
}

/** Kill a tween/timeline returned by revealRoomTitle safely (null-safe). */
export function killTween(t: gsap.core.Tween | gsap.core.Timeline | null | undefined): void {
  if (t) t.kill();
}
