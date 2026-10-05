/**
 * Regression tests for the scroll-driven scrub engine.
 *
 * Run with:  npx tsx tests/scrubEngine.test.ts
 *
 * The bug these lock down: with no scrolling at all, the walkthrough clip kept
 * showing frames AHEAD of the visitor (because the playback rate was floored),
 * and every backward scroll first had to repay that drift with seeks, which the
 * visitor perceived as lag.
 */

import { decideScrub, FRAME_TOLERANCE, PLAY_RATE_FLOOR } from '../src/utils/scrubEngine.ts';

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = '') {
  checks++;
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Minimal <video> stand-in driven by decideScrub the way the render loop is. */
class FakeClip {
  currentTime = 0;
  duration = 30;
  playing = false;
  rate = 1;
  lastSeekAt = 0;
  seeks = 0;
  now = 0;
  lastTarget = 0;

  step(targetTime: number, dt: number) {
    this.now += dt * 1000;
    const action = decideScrub({
      targetTime,
      currentTime: this.currentTime,
      duration: this.duration,
      velocity: dt > 0 ? (targetTime - this.lastTarget) / dt : 0,
      lastHardSeekAt: this.lastSeekAt,
      now: this.now
    });
    this.lastTarget = targetTime;

    switch (action.kind) {
      case 'seek':
        this.lastSeekAt = this.now;
        this.currentTime = action.time;
        this.seeks++;
        this.playing = false; // a seek interrupts playback until data arrives
        break;
      case 'play':
        this.rate = action.rate;
        this.playing = true;
        this.currentTime += action.rate * dt;
        break;
      case 'hold':
        this.playing = false;
        break;
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
console.log('\n1. Idle clip must NOT advance past the scroll position');
{
  // Give the clip a head start (as happens mid-scroll) then let the target sit
  // still — a forward-floored engine would keep creeping forward here.
  const clip = new FakeClip();
  const dt = 1 / 60;
  const target = 10;
  for (let i = 0; i < 30; i++) clip.step(target, dt);
  const before = clip.currentTime;
  for (let i = 0; i < 600; i++) clip.step(target, dt); // 10 seconds of idle
  check('idle clip stays put', Math.abs(clip.currentTime - before) < 1e-9,
    `moved ${(clip.currentTime - before).toFixed(3)}s while idle`);
  check('idle clip is not playing', clip.playing === false);
}

// ---------------------------------------------------------------------------
console.log('\n2. A clip sitting AHEAD of the target is frozen, never played forward');
{
  const clip = new FakeClip();
  const dt = 1 / 60;
  const target = 10;
  for (let i = 0; i < 30; i++) clip.step(target, dt);
  const positionBefore = clip.currentTime;
  // Visitor scrolls backwards: target is now behind the displayed frame.
  const backTarget = target - 0.02; // slightly ahead => must hold, not creep
  for (let i = 0; i < 120; i++) clip.step(backTarget, dt);
  check('does not play forward while ahead', clip.playing === false);
  check('did not advance past the start of the backward window',
    clip.currentTime <= positionBefore + 1e-9,
    `advanced ${(clip.currentTime - positionBefore).toFixed(3)}s while ahead`);
}

// ---------------------------------------------------------------------------
console.log('\n3. Forward scrolling produces fluid playback (consecutive frames)');
{
  const clip = new FakeClip();
  const dt = 1 / 60;
  const frames = 180; // 3 seconds of scrolling
  for (let i = 0; i < frames; i++) clip.step(((i + 1) / frames) * 2.4, dt);
  check('clip played during the scroll', clip.seeks === 0,
    `${clip.seeks} hard seeks during a 3s gentle scrub`);
  check('clip ended near the scroll target',
    Math.abs(clip.currentTime - clip.lastTarget) <= 0.5,
    `clip ${clip.currentTime.toFixed(2)}s vs target ${clip.lastTarget.toFixed(2)}s`);
}

// ---------------------------------------------------------------------------
console.log('\n4. After the visitor stops, drift is zero');
{
  const clip = new FakeClip();
  const dt = 1 / 60;
  for (let i = 0; i < 180; i++) clip.step(((i + 1) / 180) * 2.4, dt);
  const atStop = clip.currentTime;
  const targetAtStop = clip.lastTarget;
  for (let i = 0; i < 180; i++) clip.step(targetAtStop, dt); // 3s idle
  check('zero drift while idle after a scroll',
    Math.abs(clip.currentTime - atStop) < 1e-9,
    `drifted ${(clip.currentTime - atStop).toFixed(4)}s`);
}

// ---------------------------------------------------------------------------
console.log('\n5. Backward scroll does not accumulate lag');
{
  const clip = new FakeClip();
  const dt = 1 / 60;
  for (let i = 0; i < 120; i++) clip.step((i / 120) * 20, dt);
  const peak = clip.currentTime;

  let worstLag = 0;
  for (let i = 0; i < 240; i++) {
    const target = peak - (i / 240) * 8;
    clip.step(target, dt);
    worstLag = Math.max(worstLag, target - clip.currentTime);
  }
  check('backward scroll stays within tolerance (no lag buildup)',
    worstLag <= 0.6,
    `worst lag ${worstLag.toFixed(2)}s over 240 frames`);
  check('backward scroll is not seek-bombed', clip.seeks <= 24,
    `${clip.seeks} hard seeks during a 4s backward scrub`);
}

// ---------------------------------------------------------------------------
console.log('\n6. Deadband and rate floor are respected');
{
  const inside = decideScrub({
    targetTime: 10, currentTime: 10 + FRAME_TOLERANCE * 0.5, duration: 30, velocity: 0, now: 1
  });
  check('within a frame of target => hold', inside.kind === 'hold', inside.kind);

  const slow = decideScrub({
    targetTime: 10, currentTime: 10, duration: 30, velocity: PLAY_RATE_FLOOR * 0.5, now: 1
  });
  check('sub-floor velocity => hold', slow.kind === 'hold', slow.kind);

  const fast = decideScrub({
    targetTime: 10.2, currentTime: 10, duration: 30, velocity: 1.5, now: 1
  });
  check('real forward work => play', fast.kind === 'play', fast.kind);
  if (fast.kind === 'play') {
    check('play rate respects the cap', fast.rate <= 4, `rate ${fast.rate}`);
    check('play rate is above the floor', fast.rate >= PLAY_RATE_FLOOR, `rate ${fast.rate}`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n7. Hard seeks are throttled, with a rescue path');
{
  const jump = decideScrub({
    targetTime: 25, currentTime: 3, duration: 30, velocity: 0, lastHardSeekAt: 1000, now: 1300
  });
  check('big forward gap seeks once the throttle window expires', jump.kind === 'seek', jump.kind);

  const throttled = decideScrub({
    targetTime: 25, currentTime: 3, duration: 30, velocity: 0, lastHardSeekAt: 1000, now: 1050
  });
  check('repeat seek inside the interval waits', throttled.kind === 'wait', throttled.kind);

  const rescue = decideScrub({
    targetTime: 3, currentTime: 25, duration: 30, velocity: 0, lastHardSeekAt: 1000, now: 1050
  });
  check('far-ahead rescue seek bypasses the throttle', rescue.kind === 'seek', rescue.kind);
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? 'ALL PASS' : 'FAILURES'}: ${checks - failures}/${checks} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
