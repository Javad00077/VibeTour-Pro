/**
 * Regression tests for the universal video-link CORS rule.
 *
 * Run with:  npx tsx tests/videoUrlCors.test.ts
 *
 * The bug this locks down: every <video> hardcoded crossOrigin="anonymous",
 * so ANY video link hosted without CORS headers (most non-GitHub hosts)
 * failed its load outright and could never be scroll-scrubbed. Only the
 * local HandBrake-optimized copies worked. Now: CORS is requested solely
 * from hosts known to allow it; every other host streams plain.
 */

import { shouldRequestCors } from '../src/utils/videoUrlHelper.ts';

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

// ── Same-origin classes: CORS request is harmless ───────────────────────────
check('empty url → no CORS request', shouldRequestCors('') === false);
check('relative path → same origin', shouldRequestCors('/video/Royal-Palm-Master.mp4') === true);
check('blob url → same origin', shouldRequestCors('blob:https://site.example/abc') === true);
check('data url → same origin', shouldRequestCors('data:video/mp4;base64,AAAA') === true);

// ── Known CORS-friendly hosts ────────────────────────────────────────────────
check('raw.githubusercontent.com → anonymous ok', shouldRequestCors('https://raw.githubusercontent.com/javad00077/vibetour-pro/main/video.mp4') === true);
check('sub.github.io → anonymous ok', shouldRequestCors('https://javad00077.github.io/vibetour-pro/video.mp4') === true);
check('release asset objects host → anonymous ok', shouldRequestCors('https://objects.githubusercontent.com/xyz/video.mp4') === true);

// ── Unknown hosts: MUST stream plain or the load fails outright ──────────────
check('arbitrary https host → no CORS request', shouldRequestCors('https://cdn.example.com/movie.mp4') === false);
check('github.com page (no CORS) → no CORS request', shouldRequestCors('https://github.com/u/r/raw/main/v.mp4') === false);
check('google drive cdn → no CORS request', shouldRequestCors('https://lh3.googleusercontent.com/d/FILEID') === false);
check('dropbox raw → no CORS request', shouldRequestCors('https://dl.dropboxusercontent.com/s/abc/v.mp4?raw=1') === false);
check('localhost cross-port (no headers) → no CORS request', shouldRequestCors('http://localhost:8123/cinematic.mp4') === false);

// ── Robustness ────────────────────────────────────────────────────────────────
check('malformed url → no CORS request', shouldRequestCors('http://[::1:bad') === false);

console.log(`\n${failures === 0 ? 'ALL PASS' : 'FAILURES'}: ${checks - failures}/${checks} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
