/**
 * GLOBAL PUBLISH SERVICE
 * ------------------------------------------------------------------
 * The live site is a STATIC host (GitHub Pages) with no backend, and the
 * Firestore write path additionally requires the owner Google account,
 * which is unreachable on some networks (Google is blocked in Iran).
 *
 * Result: settings used to be saved to localStorage only and every other
 * device or visitor kept seeing the bundled defaults.
 *
 * This service turns "set once, visible everywhere" into ONE click by
 * committing the tour package straight to the repository through the
 * GitHub Contents API. The deploy workflow then ships those committed
 * files to every visitor within ~1 minute.
 *
 * The Personal Access Token is supplied by the owner and stored only in
 * this browser's localStorage. It never reaches the repository or the
 * compiled bundle.
 */

import { PropertyListing, PluginConfig } from '../types';

const PAT_STORAGE_KEY = 'vbt_gh_pat';

export const PUBLISH_TARGET = {
  owner: 'Javad00077',
  repo: 'VibeTour-Pro',
  branch: 'main',
  tourDataPath: 'public/tour-data.json',
  credentialPath: 'public/admin-credential.json'
};

/** Minimal shape of the owner credential we publish (hashes only, never the password). */
export interface PublishableCredential {
  email: string;
  salt: string;
  passwordHash: string;
  recoveryHash: string;
  createdAt: string;
  hashVersion: string;
}

export function getStoredPat(): string {
  try {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(PAT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredPat(token: string): void {
  try {
    if (typeof window === 'undefined') return;
    if (token && token.trim()) localStorage.setItem(PAT_STORAGE_KEY, token.trim());
    else localStorage.removeItem(PAT_STORAGE_KEY);
  } catch {
    // storage unavailable (private mode) — publishing still works this session
  }
}

export function hasStoredPat(): boolean {
  return getStoredPat().trim().length > 0;
}

/** UTF-8 safe base64 — the Contents API requires base64 of the raw bytes. */
function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

/** Create or update one repository file through the Contents API. */
export async function putRepoFile(path: string, content: string, message: string, token: string): Promise<void> {
  const { owner, repo, branch } = PUBLISH_TARGET;
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // Resolve the current sha — required when updating an existing file
  let sha: string | undefined;
  try {
    const metaRes = await fetch(`${base}?ref=${branch}`, { headers: githubHeaders(token) });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      sha = meta?.sha;
    }
  } catch {
    // first publish (file does not exist yet) or transient network issue
  }

  let res: Response;
  try {
    res = await fetch(base, {
      method: 'PUT',
      headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: toBase64Utf8(content),
        branch,
        ...(sha ? { sha } : {})
      })
    });
  } catch {
    // GitHub is unreachable (offline, blocked, or DNS/CORS failure). Report it
    // in Persian instead of leaking the raw "Failed to fetch" message.
    throw new Error('ارتباط با api.github.com برقرار نشد (اینترنت، فیلتر یا DNS)');
  }

  if (!res.ok) {
    let detail: any = null;
    try {
      detail = await res.json();
    } catch {
      // non-JSON error body
    }
    const reason = detail?.message || res.statusText || `HTTP ${res.status}`;
    const github403ScopeBlock =
      res.status === 403 && typeof detail === 'object' && detail?.message === 'Resource not accessible by personal access token'
        ? ' — این PAT دامنه‌های Files/Contents را ندارد (فین‌گرین PAT معمولاً فقط Read دارند). مخفف PAT github_pat_ به repo/write نیاز دارد یا یک Token کلاسیک با کلید repo.'
        : '';
    throw new Error(`${reason}${github403ScopeBlock}`);
  }
}

export interface PublishResult {
  ok: boolean;
  published: string[];
  failed: { path: string; reason: string }[];
}

/**
 * Publish the tour package (and the owner credential) so the static site
 * serves the admin's real settings to every visitor and device.
 */
export async function publishGlobalTourData(payload: {
  properties: PropertyListing[];
  config?: PluginConfig;
  credential?: PublishableCredential | null;
  token?: string;
}): Promise<PublishResult> {
  const token = (payload.token || getStoredPat()).trim();
  const result: PublishResult = { ok: false, published: [], failed: [] };

  if (!token) {
    result.failed.push({ path: PAT_STORAGE_KEY, reason: 'توکن گیت‌هاب تنظیم نشده است' });
    return result;
  }
  if (!Array.isArray(payload.properties) || payload.properties.length === 0) {
    result.failed.push({ path: PUBLISH_TARGET.tourDataPath, reason: 'داده‌ای برای انتشار وجود ندارد' });
    return result;
  }

  const stamp = new Date().toISOString();

  // Never let an unexpected failure abort the caller's save flow: publishing is
  // a best-effort side effect on top of the local save that already succeeded.
  try {
    // 1) The tour package every visitor loads
    const tourJson = JSON.stringify(
      {
        properties: payload.properties,
        config: payload.config || {},
        updatedAt: stamp
      },
      null,
      2
    );
    try {
      await putRepoFile(PUBLISH_TARGET.tourDataPath, tourJson, 'Publish tour settings globally (VibeTour dashboard)', token);
      result.published.push(PUBLISH_TARGET.tourDataPath);
    } catch (err: any) {
      result.failed.push({ path: PUBLISH_TARGET.tourDataPath, reason: err?.message || 'خطای نامشخص' });
    }

    // 2) The owner credential — PBKDF2 hashes only. Enables one managed admin
    //    account on every device via the new-device sign-in.
    if (payload.credential && payload.credential.email) {
      const cred = payload.credential;
      const credJson = JSON.stringify(
        {
          email: cred.email,
          salt: cred.salt,
          passwordHash: cred.passwordHash,
          recoveryHash: cred.recoveryHash,
          createdAt: cred.createdAt,
          hashVersion: cred.hashVersion,
          updatedAt: stamp
        },
        null,
        2
      );
      try {
        await putRepoFile(PUBLISH_TARGET.credentialPath, credJson, 'Publish admin credential for cross-device sign-in (hashes only)', token);
        result.published.push(PUBLISH_TARGET.credentialPath);
      } catch (err: any) {
        result.failed.push({ path: PUBLISH_TARGET.credentialPath, reason: err?.message || 'خطای نامشخص' });
      }
    }
  } catch (err: any) {
    // Unexpected error (serialization, quota, ...) — report it as a failed publish
    // instead of throwing into the save flow.
    result.failed.push({ path: PUBLISH_TARGET.tourDataPath, reason: err?.message || 'خطای نامشخص' });
  }

  result.ok = result.failed.length === 0 && result.published.length > 0;
  return result;
}

export interface PublishedProbe {
  tourData: { exists: boolean; updatedAt: string; propertyCount: number };
  credential: { exists: boolean; email: string };
}

function siteBase(): string {
  const raw = (import.meta as any)?.env?.BASE_URL || './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * Read what the LIVE site currently serves, so the dashboard can tell the
 * owner exactly what is published and what is still missing.
 */
export async function probePublishedState(): Promise<PublishedProbe> {
  const base = siteBase();
  const probe: PublishedProbe = {
    tourData: { exists: false, updatedAt: '', propertyCount: 0 },
    credential: { exists: false, email: '' }
  };

  try {
    const res = await fetch(`${base}tour-data.json?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      probe.tourData = {
        exists: true,
        updatedAt: data?.updatedAt || '',
        propertyCount: Array.isArray(data?.properties) ? data.properties.length : 0
      };
    }
  } catch {
    // offline or file:// — reported as "not published"
  }

  try {
    const res = await fetch(`${base}admin-credential.json?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      probe.credential = { exists: !!data?.email, email: data?.email || '' };
    }
  } catch {
    // not published yet
  }

  return probe;
}
