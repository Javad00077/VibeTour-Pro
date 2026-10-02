import { PropertyListing, PluginConfig } from '../types';
import { LUXURY_PROPERTIES, DEFAULT_CONFIG } from '../data/properties';
import {
  getCloudTourData,
  saveCloudTourData,
  subscribeToCloudTourData,
  CloudTourData
} from '../firebase';

// Bumped to v8 — per-chapter video restart behavior + local GitHub URL mapping
const LS_PROPERTIES_KEY = 'vbt_properties_v8';
const LS_CONFIG_KEY = 'vbt_config_v8';
const LS_SELECTED_PROP_ID_KEY = 'vbt_selected_property_id_v8';
const LS_ACTIVE_ROOM_ID_KEY = 'vbt_active_room_id_v8';

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
  // Guard against invalid / unset values only — never override a deliberate setting
  const speed = merged.scrollSpeedFactor;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0 || speed > 3) {
    merged.scrollSpeedFactor = DEFAULT_CONFIG.scrollSpeedFactor;
  }
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

  // Load from Firebase Firestore / Backend / IndexedDB asynchronously
  public static async loadAsyncData(): Promise<{
    properties?: PropertyListing[];
    config?: PluginConfig;
    selectedPropertyId?: string;
    activeRoomId?: string;
  } | null> {
    // 1. Attempt Firebase Cloud Firestore first (Global real-time cross-device database)
    try {
      const cloudData = await getCloudTourData();
      if (cloudData && Array.isArray(cloudData.properties) && cloudData.properties.length > 0) {
        // Cache to LocalStorage and IndexedDB
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(LS_PROPERTIES_KEY, JSON.stringify(cloudData.properties));
            if (cloudData.config) {
              localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(cloudData.config));
            }
            if (cloudData.selectedPropertyId) {
              localStorage.setItem(LS_SELECTED_PROP_ID_KEY, cloudData.selectedPropertyId);
            }
            if (cloudData.activeRoomId) {
              localStorage.setItem(LS_ACTIVE_ROOM_ID_KEY, cloudData.activeRoomId);
            }
          }
          await idbSet('properties', cloudData.properties);
          if (cloudData.config) {
            await idbSet('config', cloudData.config);
          }
        } catch {}

        const cleanProps = sanitizeProperties(cloudData.properties);
        return {
          properties: cleanProps,
          config: sanitizeConfig(cloudData.config),
          selectedPropertyId: cloudData.selectedPropertyId,
          activeRoomId: cloudData.activeRoomId,
        };
      }
    } catch (err) {
      console.warn('[Firebase Firestore] Cloud database read notice:', err);
    }

    // 2. Attempt backend API second (if local Express server is running)
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.properties) && data.properties.length > 0) {
          const cfgRes = await fetch('/api/config');
          const cfgData = cfgRes.ok ? await cfgRes.json() : null;
          const stateRes = await fetch('/api/active-state');
          const stateData = stateRes.ok ? await stateRes.json() : null;

          const cleanProps = sanitizeProperties(data.properties);
          return {
            properties: cleanProps,
            config: sanitizeConfig(cfgData),
            selectedPropertyId: stateData?.selectedPropertyId,
            activeRoomId: stateData?.activeRoomId,
          };
        }
      }
    } catch {
      // Backend not running (e.g. GitHub Pages static host)
    }

    // 3. Attempt static GitHub Pages bundled tour-data.json
    try {
      const baseUrl = ((import.meta as any)?.env?.BASE_URL) || './';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const tourJsonUrl = `${cleanBase}tour-data.json?t=${Date.now()}`;
      
      const staticRes = await fetch(tourJsonUrl);
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (Array.isArray(staticData.properties) && staticData.properties.length > 0) {
          const cleanCfg = sanitizeConfig(staticData.config);
          const cleanProps = sanitizeProperties(staticData.properties);
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(LS_PROPERTIES_KEY, JSON.stringify(cleanProps));
              localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(cleanCfg));
            }
            await idbSet('properties', cleanProps);
            await idbSet('config', cleanCfg);
          } catch {}

          return {
            properties: cleanProps,
            config: cleanCfg,
            selectedPropertyId: staticData.selectedPropertyId,
            activeRoomId: staticData.activeRoomId,
          };
        }
      }
    } catch {
      // Static tour-data.json not reachable
    }

    // 4. Attempt local IndexedDB
    try {
      const idbProps = await idbGet<PropertyListing[]>('properties');
      const idbCfg = await idbGet<PluginConfig>('config');
      const idbSelected = await idbGet<string>('selectedPropertyId');
      const idbRoom = await idbGet<string>('activeRoomId');

      if (idbProps && Array.isArray(idbProps) && idbProps.length > 0) {
        return {
          properties: sanitizeProperties(idbProps),
          config: sanitizeConfig(idbCfg),
          selectedPropertyId: idbSelected || undefined,
          activeRoomId: idbRoom || undefined,
        };
      }
    } catch {}

    return null;
  }

  // Save all properties to LocalStorage, IndexedDB, Firebase Firestore, and Backend API
  public static async saveProperties(properties: PropertyListing[]): Promise<boolean> {
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

    // Save to Firebase Firestore Cloud Database for all global devices
    const currentCfg = StorageService.getInitialConfig();
    const currentPropId = StorageService.getInitialSelectedPropertyId() || properties[0]?.id;
    const currentRoomId = StorageService.getInitialActiveRoomId() || properties[0]?.rooms[0]?.id;
    saveCloudTourData(properties, currentCfg, currentPropId, currentRoomId).catch((err) => {
      console.warn('[Firebase Firestore] Cloud save notice:', err);
    });

    // Save to Backend API if server is alive
    try {
      await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties }),
      });
    } catch {
      // Offline or static GitHub Pages hosting
    }

    return lsSuccess || idbSuccess;
  }

  // Save configuration
  public static async saveConfig(config: PluginConfig): Promise<boolean> {
    const cleanConfig: PluginConfig = sanitizeConfig(config);

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

    // Save to Firebase Cloud Firestore
    const currentProps = StorageService.getInitialProperties();
    const currentPropId = StorageService.getInitialSelectedPropertyId();
    const currentRoomId = StorageService.getInitialActiveRoomId();
    saveCloudTourData(currentProps, cleanConfig, currentPropId || undefined, currentRoomId || undefined).catch((err) => {
      console.warn('[Firebase Firestore] Cloud config save notice:', err);
    });

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanConfig),
      });
    } catch {}

    return lsSuccess;
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

    try {
      await fetch('/api/active-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPropertyId: propertyId, activeRoomId: roomId }),
      });
    } catch {}
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

    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch {}
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

  // Generate src/data/properties.ts code to permanently hardcode into Git
  public static generatePropertiesTsCode(properties: PropertyListing[]): string {
    return `import { PropertyListing, PluginConfig } from '../types';\n\nexport const LUXURY_PROPERTIES: PropertyListing[] = ${JSON.stringify(properties, null, 2)};\n`;
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
