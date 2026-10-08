/**
 * MOBILE VIDEO VARIANT RESOLVER
 * ------------------------------
 * The guest tour serves clips hosted at up to 1080p / 21 Mbps (Greatroom.mp4 =
 * 21.4 MB for EIGHT seconds). On a phone that is a stuttering decode + ~2.6 MB/s
 * of sustained network — the reported "very laggy on mobile" complaint. On
 * desktop the admin is on a fast connection with hardware decode and feels fine;
 * the guest/mobile path must be lighter.
 *
 * Resolution order for `mobileVariantCandidates`:
 *   1. Same-origin relative path with a sibling in public/video/mobile/
 *      (variants-manifest.json) → the local 720p variant FIRST, original after.
 *   2. Same-origin relative path without a variant → unchanged.
 *   3. Absolute URL (GitHub raw branch clips etc.) → try mapping the basename
 *      against the manifest; if a variant exists, the LOCAL variant goes first
 *      (same-origin = fast + range-friendly) with the remote original as
 *      fallback. Unknown absolutes are returned unchanged.
 *
 * The manifest is fetched once per session and cached. Everything stays pure
 * and synchronous-on-cache-hit so the render path never awaits.
 */

import manifestJson from '../../public/video/variants-manifest.json';

export interface VariantManifest {
  note?: string;
  generatedAt?: string;
  map: Record<string, string>;
}

export const VARIANT_MANIFEST: VariantManifest = manifestJson as VariantManifest;

/** Basename (no query), e.g. ".../Greatroom.mp4?x=1" → "greatroom.mp4". */
function basenameOf(url: string): string {
  const clean = url.split(/[?#]/)[0];
  const parts = clean.split('/');
  return parts[parts.length - 1].toLowerCase();
}

/** Manifest lookup keyed by filename — "video/Greatroom.mp4" and the raw
 *  github URL of Greatroom.mp4 both resolve to the same variant. */
const VARIANT_BY_BASENAME: Record<string, string> = Object.fromEntries(
  Object.entries(VARIANT_MANIFEST.map).map(([orig, variant]) => [basenameOf(orig), variant])
);

export function hasMobileVariant(url: string): boolean {
  return !!url && !!VARIANT_BY_BASENAME[basenameOf(url)];
}

export function getMobileVariant(url: string): string | undefined {
  if (!url) return undefined;
  return VARIANT_BY_BASENAME[basenameOf(url)];
}

/**
 * Ordered candidate list for a room's videoUrl, mobile-first when a local
 * 720p variant exists. On desktop this returns the original order untouched.
 */
export function mobileVariantCandidates(url: string, isMobile: boolean): string[] {
  if (!url) return [];
  if (!isMobile) return [url];
  const variant = getMobileVariant(url);
  if (!variant || variant === url) return [url];
  // Local variant first (fast, range-friendly), original as quality fallback.
  return variant === url ? [url] : [variant, url];
}
