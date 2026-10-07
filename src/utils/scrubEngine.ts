/**
 * Smooth-scrub decision logic for scroll-driven video walkthroughs.
 *
 * Extracted from the render loop so it can be unit-tested deterministically.
 *
 * The rule that matters: a clip must never run PAST the visitor's scroll
 * position. HTML video cannot play in reverse, so the only correct response
 * to "frame is ahead of target" is to FREEZE the frame (and seek back later,
 * once the gap is large enough to be worth a network round-trip). Flooring the
 * playback rate instead — which an earlier revision did — made the clip creep
 * forward on its own while the visitor was idle, and every backward scroll
 * then had to repay that drift with seeks, which showed up as lag.
 */

// A clip ahead of the scroll position is frozen outright.
export const FRAME_TOLERANCE = 0.03;

// Below this rate decoding is not worth it — hold the decoded frame instead.
export const PLAY_RATE_FLOOR = 0.05;

// Rate cap; browsers reject values far outside a sane range.
export const MAX_PLAY_RATE = 4;

// Proportional gain folding the residual gap into the playback rate.
// KEYFRAME-FREE MODE: raised from 2.0 to 3.2 so wide gaps are closed with
// playbackRate steering (smooth) instead of repeated hard seeks (stutters).
export const STEER_GAIN_KF = 3.2;
// Legacy alias kept for the unit tests and any external callers.
export const STEER_GAIN = STEER_GAIN_KF;

// Retries of a hard seek are throttled to 4/s per clip.
export const HARD_SEEK_INTERVAL_MS = 250;

export interface ScrubState {
  /** Playback position the visitor's scroll is asking for (seconds). */
  targetTime: number;
  /** Clip's actual position (seconds). */
  currentTime: number;
  /** Clip duration (seconds). */
  duration: number;
  /** Rate of change of targetTime in video-seconds per real second. */
  velocity: number;
  /** performance.now() of the last hard seek on this clip (0 = none). */
  lastHardSeekAt?: number;
  /** performance.now() now. */
  now: number;
}

export type ScrubAction =
  | { kind: 'wait' }
  | { kind: 'hold' }
  | { kind: 'play'; rate: number }
  | { kind: 'seek'; time: number };

const clampTime = (t: number, dur: number) => Math.max(0, Math.min(dur - 0.033, t));

/**
 * Decide what the player should do this frame.
 *
 * "Busy" states (seeking / readyState < 3) are handled by the caller: it must
 * keep the newest request and apply it when the decoder frees up, rather than
 * issuing a competing seek that would cancel the in-flight range request.
 */
export function decideScrub(state: ScrubState): ScrubAction {
  const { targetTime, currentTime, duration: dur, velocity, lastHardSeekAt = 0, now } = state;

  const error = targetTime - currentTime;

  // Hard-seek window: steering covers small gaps smoothly; anything beyond it
  // (fling / chapter jump / far reverse) snaps once, then steering resumes.
  // KEYFRAME-FREE MODE: the window is deliberately WIDE (up to 6s forward).
  // Long-GOP clips (no per-frame keyframes) stall on hard seeks — every seek
  // waits for the next I-frame — so we prefer to keep PLAYING and steer with
  // playbackRate (consecutive frames = fluid motion). The 6s cap keeps the
  // clip from racing absurdly far ahead before we snap once.
  const fwdHard = Math.min(6, Math.max(0.3, dur * 0.1));
  const backHard = Math.min(0.5, Math.max(0.2, dur * 0.008));
  const rescue = error < -backHard * 3;

  if (error < -backHard || error > fwdHard) {
    // Throttled, except a rescue seek when the clip is far ahead — that is the
    // case that would otherwise accumulate lag on fast backward scrolls.
    if (now - lastHardSeekAt > HARD_SEEK_INTERVAL_MS || rescue) {
      return { kind: 'seek', time: clampTime(targetTime, dur) };
    }
    return { kind: 'wait' };
  }

  if (error < -FRAME_TOLERANCE) {
    // AHEAD of the visitor: reverse playback does not exist, so freeze.
    return { kind: 'hold' };
  }

  // No floor: a rate under PLAY_RATE_FLOOR is not worth decoding.
  // KEYFRAME-FREE: the steer gain is raised so the clip catches up quickly but
  // smoothly (rate stays consecutive, no seek stalls). Rate cap still 4x.
  const rate = Math.max(0, Math.min(MAX_PLAY_RATE, velocity + error * STEER_GAIN_KF));

  if (rate < PLAY_RATE_FLOOR) {
    // Aligned with the target (or idle): hold the decoded frame — the canvas
    // keeps painting it, so there is no poster flash and no drift.
    return { kind: 'hold' };
  }

  return { kind: 'play', rate };
}
