import { PropertyListing, PluginConfig } from '../types';
import { LUXURY_PROPERTIES, DEFAULT_CONFIG } from '../data/properties';

const LS_PROPERTIES_KEY = 'vbt_properties_v2';
const LS_CONFIG_KEY = 'vbt_config_v2';
const LS_SELECTED_PROP_ID_KEY = 'vbt_selected_property_id_v2';
const LS_ACTIVE_ROOM_ID_KEY = 'vbt_active_room_id_v2';

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

export class StorageService {
  // Synchronous initial load for seamless React initialization without layout shifts
  public static getInitialProperties(): PropertyListing[] {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(LS_PROPERTIES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read properties from localStorage:', e);
    }
    return LUXURY_PROPERTIES;
  }

  public static getInitialConfig(): PluginConfig {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(LS_CONFIG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return {
              ...DEFAULT_CONFIG,
              ...parsed,
              language: 'en' // Always enforce English as requested
            };
          }
        }
      }
    } catch (e) {
      console.warn('Could not read config from localStorage:', e);
    }
    return { ...DEFAULT_CONFIG, language: 'en' };
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

  // Load from backend / IndexedDB asynchronously and update if newer
  public static async loadAsyncData(): Promise<{
    properties?: PropertyListing[];
    config?: PluginConfig;
    selectedPropertyId?: string;
    activeRoomId?: string;
  } | null> {
    // 1. Attempt backend API first
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.properties) && data.properties.length > 0) {
          const cfgRes = await fetch('/api/config');
          const cfgData = cfgRes.ok ? await cfgRes.json() : null;
          const stateRes = await fetch('/api/active-state');
          const stateData = stateRes.ok ? await stateRes.json() : null;

          return {
            properties: data.properties,
            config: cfgData ? { ...DEFAULT_CONFIG, ...cfgData, language: 'en' } : undefined,
            selectedPropertyId: stateData?.selectedPropertyId,
            activeRoomId: stateData?.activeRoomId,
          };
        }
      }
    } catch {
      // Backend not running (e.g. GitHub Pages static host)
    }

    // 2. Attempt IndexedDB
    try {
      const idbProps = await idbGet<PropertyListing[]>('properties');
      const idbCfg = await idbGet<PluginConfig>('config');
      const idbSelected = await idbGet<string>('selectedPropertyId');
      const idbRoom = await idbGet<string>('activeRoomId');

      if (idbProps && Array.isArray(idbProps) && idbProps.length > 0) {
        return {
          properties: idbProps,
          config: idbCfg ? { ...DEFAULT_CONFIG, ...idbCfg, language: 'en' } : undefined,
          selectedPropertyId: idbSelected || undefined,
          activeRoomId: idbRoom || undefined,
        };
      }
    } catch {}

    return null;
  }

  // Save all properties to LocalStorage, IndexedDB, and Backend API
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

    // Always persist to IndexedDB (virtually unlimited quota for high-res images and many rooms)
    const idbSuccess = await idbSet('properties', properties);

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
    const cleanConfig: PluginConfig = {
      ...config,
      language: 'en' // English-only enforcement
    };

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
