import { PropertyListing, PluginConfig } from '../types';
import { LUXURY_PROPERTIES, DEFAULT_CONFIG } from '../data/properties';
import {
  getCloudTourData,
  saveCloudTourData,
  subscribeToCloudTourData,
  CloudTourData,
  isOwnerGoogleUser
} from '../firebase';
import { isStaticHost } from '../utils/videoUrlHelper';

// Bumped to v8 — per-chapter video restart behavior + local GitHub URL mapping
const LS_PROPERTIES_KEY = 'vbt_properties_v8';
const LS_CONFIG_KEY = 'vbt_config_v8';
const LS_SELECTED_PROP_ID_KEY = 'vbt_selected_property_id_v8';
const LS_ACTIVE_ROOM_ID_KEY = 'vbt_active_room_id_v8';
const LS_UPDATED_AT_KEY = 'vbt_updated_at_v1';

// ---------------------------------------------------------------------
// Last-edit timestamp — lets every device pick the NEWEST copy of the
// tour data (local edit vs cloud vs published tour-data.json) instead of
// letting a stale bundled file clobber fresh admin settings.
// ---------------------------------------------------------------------
function touchLastEdit(): string {
  const stamp = new Date().toISOString();
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_UPDATED_AT_KEY, stamp);
    }
  } catch {}
  return stamp;
}

export function getLastEditTimestamp(): string {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LS_UPDATED_AT_KEY) || '';
    }
  } catch {}
  return '';
}

/** Outcome of the most recent cloud (Firestore) save attempt. */
let lastCloudSaveOutcome: { attempted: boolean; success: boolean; at: string } = {
  attempted: false,
  success: false,
  at: ''
};

export function getLastCloudSaveOutcome() {
  return { ...lastCloudSaveOutcome };
}

/**
 * True when a cloud snapshot is safe to apply over the local state.
 * Guards the realtime subscription against overwriting newer local edits
 * with an older cloud copy (e.g. when the owner edited while offline).
 */
export function isCloudDataNewer(cloudUpdatedAt?: string): boolean {
  const local = getLastEditTimestamp();
  if (!cloudUpdatedAt) return !local; // no timestamps → cloud may initialize
  if (!local) return true;
  return cloudUpdatedAt >= local;
}

const IDB_NAME = 'VibeTourProDB';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'tour_data';

// Helper to open IndexedDB
function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, val: any): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// Helper to sanitize config while preserving the admin's chosen scroll speed
export function sanitizeConfig(cfg?: PluginConfig | null): PluginConfig {
  const merged: PluginConfig = {
    ...DEFAULT_CONFIG,
    ...(cfg || {}),
    language: 'en'
  };
  // Scroll speed is LOCKED at the tuned 0.25x default. Older sessions stored 0.5
  // (and legacy code fell back to 0.1/0.5), which kept overriding the requested
  // 0.25 — force it here so every load path (localStorage, cloud, bundled store)
  // converges to the same smooth, lag-free value.
  merged.scrollSpeedFactor = DEFAULT_CONFIG.scrollSpeedFactor;
  return merged;
}

/**
 * Past GitHub sample videos are auto-mapped to the identical locally-optimized
 * copies shipped in public/video/. Remote raw.githubusercontent streaming is
 * the #1 cause of laggy scrubbing (every seek = a fresh network round-trip).
 */
const GITHUBToLocalVideoMap: Record<string, string> = {
  'https://github.com/javad00077/vibetour-pro/raw/refs/heads/javad00077-patch-1/camera%20entering%20room%20showing%20brand%20202608091805.mp4':
    'video/Royal-Palm-Master.mp4',
  'https://raw.githubusercontent.com/javad00077/vibetour-pro/javad00077-patch-1/camera%20entering%20room%20showing%20brand%20202608091805.mp4':
    'video/Royal-Palm-Master.mp4',
  'https://github.com/javad00077/vibetour-pro/raw/refs/heads/javad00077-patch-1/camera entering room showing brand 202608091805.mp4':
    'video/Royal-Palm-Master.mp4',
  'https://raw.githubusercontent.com/javad00077/vibetour-pro/javad00077-patch-1/camera entering room showing brand 202608091805.mp4':
    'video/Royal-Palm-Master.mp4'
};

function mapRemoteVideoToLocal(url: string): string {
  const clean = (url || '').trim();
  if (!clean) return clean;
  const lower = clean.toLowerCase();
  if (GITHUBToLocalVideoMap[lower]) return GITHUBToLocalVideoMap[lower];
  try {
    const decoded = decodeURIComponent(lower);
    if (GITHUBToLocalVideoMap[decoded]) return GITHUBToLocalVideoMap[decoded];
  } catch {}
  return clean;
}

// Helper to sanitize properties (keeps per-room videos, only strips broken values)
export function sanitizeProperties(properties: PropertyListing[]): PropertyListing[] {
  if (!Array.isArray(properties)) return [];
  return properties.map((p) => ({
    ...p,
    rooms: (p.rooms || []).map((r) => {
      const cleanVideoUrl = (r.videoUrl || '').trim();
      // Strip broken/accidental values (old sample clips, error text); empty means fall back to poster image
      const isBroken =
        cleanVideoUrl.startsWith('blob:') ||
        cleanVideoUrl.includes('App Error') ||
        cleanVideoUrl.includes('[vite]') ||
        cleanVideoUrl.includes('ForBiggerBlazes') ||
        cleanVideoUrl.includes('WeAreGoingOnBullrun') ||
        cleanVideoUrl.includes('Sintel');
      return {
        ...r,
        videoUrl: isBroken ? '' : mapRemoteVideoToLocal(cleanVideoUrl)
      };
    })
  }));
}

export class StorageService {
  // Synchronous initial load for seamless React initialization without layout shifts
  public static getInitialProperties(): PropertyListing[] {
    try {
      if (typeof window !== 'undefined') {
        try {
          ['vbt_properties_v1', 'vbt_properties_v2', 'vbt_properties_v3', 'vbt_properties_v4', 'vbt_properties_v5', 'vbt_properties_v6', 'vbt_properties_v7', 'vbt_config_v5', 'vbt_config_v6', 'vbt_config_v7', 'vbt_selected_property_id_v5', 'vbt_selected_property_id_v6', 'vbt_selected_property_id_v7', 'vbt_active_room_id_v5', 'vbt_active_room_id_v6', 'vbt_active_room_id_v7'].forEach((k) => localStorage.removeItem(k));
        } catch {}

        const raw = localStorage.getItem(LS_PROPERTIES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return sanitizeProperties(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read properties from localStorage:', e);
    }
    return sanitizeProperties(LUXURY_PROPERTIES);
  }

  public static getInitialConfig(): PluginConfig {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(LS_CONFIG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const clean = sanitizeConfig(parsed);
            localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(clean));
            return clean;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read config from localStorage:', e);
    }
    return sanitizeConfig(null);
  }

  public static getInitialSelectedPropertyId(): string | null {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(LS_SELECTED_PROP_ID_KEY);
      }
    } catch {}
    return null;
  }

  public static getInitialActiveRoomId(): string | null {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(LS_ACTIVE_ROOM_ID_KEY);
      }
    } catch {}
    return null;
  }

  // ---------------------------------------------------------------------
  // Async load — NEWEST-WINS across all stores.
  // Candidates: Firestore cloud (owner publishes), backend API (local dev
  // server), static published tour-data.json (GitHub Pages global store),
  // and the local IndexedDB edit cache. Whichever carries the newest
  // `updatedAt` wins, so a fresh visitor receives the published settings
  // while the owner's newer offline edits are never clobbered.
  // ---------------------------------------------------------------------
  public static async loadAsyncData(): Promise<{
    properties?: PropertyListing[];
    config?: PluginConfig;
    selectedPropertyId?: string;
    activeRoomId?: string;
  } | null> {
    interface Candidate {
      source: 'cloud' | 'backend' | 'static' | 'local';
      priority: number; // tie-breaker when timestamps are missing/equal
      updatedAt: string;
      properties: PropertyListing[];
      config?: PluginConfig;
      selectedPropertyId?: string;
      activeRoomId?: string;
    }
    const candidates: Candidate[] = [];

    // 1. Firebase Cloud Firestore (global real-time cross-device database)
    try {
      const cloudData = await getCloudTourData();
      if (cloudData && Array.isArray(cloudData.properties) && cloudData.properties.length > 0) {
        candidates.push({
          source: 'cloud',
          priority: 3,
          updatedAt: (cloudData as any).updatedAt || '',
          properties: cloudData.properties,
          config: cloudData.config,
          selectedPropertyId: cloudData.selectedPropertyId,
          activeRoomId: cloudData.activeRoomId,
        });
      }
    } catch (err) {
      console.warn('[Firebase Firestore] Cloud database read notice:', err);
    }

    // 2. Backend API (only meaningful where the Express server actually runs)
    if (!isStaticHost()) {
      try {
        const res = await fetch('/api/properties');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.properties) && data.properties.length > 0) {
            const cfgRes = await fetch('/api/config');
            const cfgData = cfgRes.ok ? await cfgRes.json() : null;
            const stateRes = await fetch('/api/active-state');
            const stateData = stateRes.ok ? await stateRes.json() : null;
            candidates.push({
              source: 'backend',
              priority: 2,
              updatedAt: data.updatedAt || '',
              properties: data.properties,
              config: cfgData || undefined,
              selectedPropertyId: stateData?.selectedPropertyId,
              activeRoomId: stateData?.activeRoomId,
            });
          }
        }
      } catch {
        // Backend not running
      }
    }

    // 3. Static published tour-data.json (the GitHub Pages global store)
    let staticCandidate: Candidate | null = null;
    try {
      const baseUrl = ((import.meta as any)?.env?.BASE_URL) || './';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const tourJsonUrl = `${cleanBase}tour-data.json?t=${Date.now()}`;
      const staticRes = await fetch(tourJsonUrl);
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (Array.isArray(staticData.properties) && staticData.properties.length > 0) {
          staticCandidate = {
            source: 'static',
            priority: 1,
            updatedAt: staticData.updatedAt || '',
            properties: staticData.properties,
            config: staticData.config,
            selectedPropertyId: staticData.selectedPropertyId,
            activeRoomId: staticData.activeRoomId,
          };
          candidates.push(staticCandidate);
        }
      }
    } catch {
      // Static tour-data.json not reachable
    }

    // 4. Local edit cache (IndexedDB + last-edit timestamp)
    try {
      const idbProps = await idbGet<PropertyListing[]>('properties');
      const idbCfg = await idbGet<PluginConfig>('config');
      const idbSelected = await idbGet<string>('selectedPropertyId');
      const idbRoom = await idbGet<string>('activeRoomId');
      if (idbProps && Array.isArray(idbProps) && idbProps.length > 0) {
        candidates.push({
          source: 'local',
          priority: 0,
          updatedAt: getLastEditTimestamp(),
          properties: idbProps,
          config: idbCfg || undefined,
          selectedPropertyId: idbSelected || undefined,
          activeRoomId: idbRoom || undefined,
        });
      }
    } catch {}

    if (candidates.length === 0) return null;

    // Newest timestamp wins; missing timestamps lose to any timestamp;
    // when everything is timestamp-less, source priority decides.
    let best = candidates[0];
    for (const c of candidates) {
      if (c.updatedAt && best.updatedAt && c.updatedAt > best.updatedAt) {
        best = c;
      } else if (c.updatedAt && !best.updatedAt) {
        best = c;
      } else if (!c.updatedAt && !best.updatedAt && c.priority > best.priority) {
        best = c;
      }
    }

    // Cache the winning copy so the next cold start paints it instantly
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_PROPERTIES_KEY, JSON.stringify(best.properties));
        if (best.config) {
          localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(best.config));
        }
        if (best.selectedPropertyId) {
          localStorage.setItem(LS_SELECTED_PROP_ID_KEY, best.selectedPropertyId);
        }
        if (best.activeRoomId) {
          localStorage.setItem(LS_ACTIVE_ROOM_ID_KEY, best.activeRoomId);
        }
      }
      await idbSet('properties', best.properties);
      if (best.config) {
        await idbSet('config', best.config);
      }
    } catch {}

    console.info(`[VibeTour] Tour data loaded from: ${best.source}` + (best.updatedAt ? ` (updated ${best.updatedAt})` : ''));
    return {
      properties: sanitizeProperties(best.properties),
      config: sanitizeConfig(best.config),
      selectedPropertyId: best.selectedPropertyId,
      activeRoomId: best.activeRoomId,
    };
  }

  // Save all properties to LocalStorage, IndexedDB, Firebase Firestore, and Backend API
  public static async saveProperties(properties: PropertyListing[]): Promise<boolean> {
    const editStamp = touchLastEdit();

    let lsSuccess = false;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_PROPERTIES_KEY, JSON.stringify(properties));
        lsSuccess = true;
      }
    } catch (e) {
      console.warn('LocalStorage quota or write error (will persist in IndexedDB):', e);
    }

    // Always persist to IndexedDB
    const idbSuccess = await idbSet('properties', properties);

    // Persist to a local backend server if one is running (skipped on static hosts).
    if (!isStaticHost()) {
      try {
        const res = await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties, updatedAt: editStamp }),
        });
        if (res.status >= 200 && res.status < 300) {
          lsSuccess = true;
        }
      } catch (e) {
        // Not running -- rely on localStorage/IndexedDB/Firestore.
      }
    }

    // Cloud Firestore -- secure, owner-only global write.
    // Awaited so the caller knows the REAL cloud outcome (no fake success).
    if (isOwnerGoogleUser()) {
      lastCloudSaveOutcome = { attempted: true, success: false, at: editStamp };
      const currentCfg = StorageService.getInitialConfig();
      const currentPropId = StorageService.getInitialSelectedPropertyId() || properties[0]?.id;
      const currentRoomId = StorageService.getInitialActiveRoomId() || properties[0]?.rooms[0]?.id;
      try {
        const cloudOk = await saveCloudTourData(properties, currentCfg, currentPropId, currentRoomId);
        lastCloudSaveOutcome = { attempted: true, success: cloudOk, at: editStamp };
        if (!cloudOk) {
          console.warn('[VibeTour] Firestore write did not succeed — data kept on this device only.');
        }
      } catch (err) {
        lastCloudSaveOutcome = { attempted: true, success: false, at: editStamp };
        console.warn('[Firebase Firestore] Cloud save notice:', err);
      }
    }

    return lsSuccess || idbSuccess;
  }

  public static async saveConfig(config: PluginConfig): Promise<boolean> {
    const cleanConfig: PluginConfig = sanitizeConfig(config);
    const editStamp = touchLastEdit();

    let lsSuccess = false;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(cleanConfig));
        lsSuccess = true;
      }
    } catch (e) {
      console.warn('Config write error to localStorage:', e);
    }

    await idbSet('config', cleanConfig);

    // Persist to a local backend server if one is running (skipped on static hosts).
    if (!isStaticHost()) {
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...cleanConfig, updatedAt: editStamp }),
        });
        if (res.status >= 200 && res.status < 300) {
          lsSuccess = true;
        }
      } catch {
        // Not running -- rely on localStorage/IndexedDB/Firestore.
      }
    }

    // Cloud Firestore -- secure, owner-only global write (awaited, real outcome).
    if (isOwnerGoogleUser()) {
      lastCloudSaveOutcome = { attempted: true, success: false, at: editStamp };
      const currentProps = StorageService.getInitialProperties();
      const currentPropId = StorageService.getInitialSelectedPropertyId();
      const currentRoomId = StorageService.getInitialActiveRoomId();
      try {
        const cloudOk = await saveCloudTourData(currentProps, cleanConfig, currentPropId || undefined, currentRoomId || undefined);
        lastCloudSaveOutcome = { attempted: true, success: cloudOk, at: editStamp };
        if (!cloudOk) {
          console.warn('[VibeTour] Firestore config write did not succeed — kept on this device only.');
        }
      } catch (err) {
        lastCloudSaveOutcome = { attempted: true, success: false, at: editStamp };
        console.warn('[Firebase Firestore] Cloud config save notice:', err);
      }
    }
    // If the owner is not signed in, the privileged write is skipped entirely.

    return lsSuccess || (await idbGet<PluginConfig>('config') !== null);
  }
  // Save selected property ID & active room
  public static async saveActiveState(propertyId: string, roomId?: string): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SELECTED_PROP_ID_KEY, propertyId);
        if (roomId) {
          localStorage.setItem(LS_ACTIVE_ROOM_ID_KEY, roomId);
        }
      }
    } catch {}

    await idbSet('selectedPropertyId', propertyId);
    if (roomId) {
      await idbSet('activeRoomId', roomId);
    }

    if (!isStaticHost()) {
      try {
        await fetch('/api/active-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedPropertyId: propertyId, activeRoomId: roomId }),
        });
      } catch {}
    }
  }

  // Expose Realtime Firestore subscription for seamless multi-device live updates
  public static subscribeToCloudTourData = subscribeToCloudTourData;

  // Hard Reset
  public static async resetAll(defaultProps: PropertyListing[], defaultCfg: PluginConfig): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LS_PROPERTIES_KEY);
        localStorage.removeItem(LS_CONFIG_KEY);
        localStorage.removeItem(LS_SELECTED_PROP_ID_KEY);
        localStorage.removeItem(LS_ACTIVE_ROOM_ID_KEY);
      }
    } catch {}

    await idbSet('properties', defaultProps);
    await idbSet('config', { ...defaultCfg, language: 'en' });
    await idbSet('selectedPropertyId', defaultProps[0].id);
    await idbSet('activeRoomId', defaultProps[0].rooms[0].id);

    if (!isStaticHost()) {
      try {
        await fetch('/api/reset', { method: 'POST' });
      } catch {}
    }
  }

  // Export complete tour package (properties + config) as JSON string
  public static exportFullTourPackageJson(properties: PropertyListing[], config?: PluginConfig): string {
    return JSON.stringify({
      properties,
      config: config || DEFAULT_CONFIG,
      updatedAt: new Date().toISOString()
    }, null, 2);
  }

  // Trigger browser download of tour-data.json for GitHub repository placement
  public static downloadTourDataFile(properties: PropertyListing[], config?: PluginConfig): void {
    if (typeof window === 'undefined') return;
    const jsonStr = this.exportFullTourPackageJson(properties, config);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tour-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Generate src/data/properties.ts code to permanently hardcode into Git.
  // The output must be a COMPLETE, compilable file: App.tsx and this module
  // import both LUXURY_PROPERTIES and DEFAULT_CONFIG, so emitting only the
  // properties array would break `vite build` and stop all deploys.
  public static generatePropertiesTsCode(properties: PropertyListing[], config?: PluginConfig): string {
    const effectiveConfig: PluginConfig = config || DEFAULT_CONFIG;
    return [
      "import { PropertyListing, PluginConfig } from '../types';",
      '',
      'export const LUXURY_PROPERTIES: PropertyListing[] = ' +
        JSON.stringify(properties, null, 2) +
        ';',
      '',
      'export const DEFAULT_CONFIG: PluginConfig = ' +
        JSON.stringify(effectiveConfig, null, 2) +
        ';',
      ''
    ].join('\n');
  }

  // Export JSON configuration file
  public static exportPropertiesJson(properties: PropertyListing[]): string {
    return JSON.stringify(properties, null, 2);
  }

  // Import JSON configuration file
  public static importPropertiesJson(jsonString: string): PropertyListing[] {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid JSON format: Expected a non-empty array of properties.');
    }
    // Basic validation
    for (const item of parsed) {
      if (!item.id || !item.title || !Array.isArray(item.rooms)) {
        throw new Error('Invalid property item: missing id, title, or rooms array.');
      }
    }
    return parsed as PropertyListing[];
  }
}
