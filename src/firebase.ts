import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { isOwnerGoogleUser, ADMIN_EMAILS } from './firebaseAuth';
export { isOwnerGoogleUser };
import { PropertyListing, PluginConfig } from './types';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore (utilizing dedicated firestoreDatabaseId if configured)
export const db: Firestore = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

const MASTER_DOC_PATH = 'tour_package';

/**
 * Cloud schema version — bump when the bundled tour data changes fundamentally.
 * Cloud documents written by older app versions are ignored (treated as stale)
 * so the corrected local tour always wins over outdated cloud payloads.
 */
export const CLOUD_SCHEMA_VERSION = 4;

export interface CloudTourData {
  properties: PropertyListing[];
  config?: PluginConfig;
  selectedPropertyId?: string;
  activeRoomId?: string;
  schemaVersion?: number;
  updatedAt: string;
}

// Attempt anonymous authentication if available
let authPromise: Promise<void> | null = null;
export async function ensureAuth(): Promise<void> {
  if (auth.currentUser) return;
  if (!authPromise) {
    authPromise = signInAnonymously(auth)
      .then(() => {})
      .catch((e) => {
        // If anonymous auth is disabled, open rules will handle requests
        console.info('[Firebase Auth] Continuing with public access rules');
      });
  }
  return authPromise;
}

// Fetch complete tour dataset from Firebase Cloud Firestore
export async function getCloudTourData(): Promise<CloudTourData | null> {
  try {
    await ensureAuth();
    const docRef = doc(db, 'tour_data', MASTER_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CloudTourData;
      // Ignore stale cloud documents written before the current schema version
      if (Array.isArray(data.properties) && data.properties.length > 0 && data.schemaVersion === CLOUD_SCHEMA_VERSION) {
        return data;
      }
    }
  } catch (err: any) {
    console.warn('[Firebase Firestore] Notice while reading cloud data:', err?.message || err);
  }
  return null;
}

// Serialized debounced cloud write queue to prevent write stream exhaustion
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isSaving = false;
let pendingData: {
  properties: PropertyListing[];
  config?: PluginConfig;
  selectedPropertyId?: string;
  activeRoomId?: string;
  resolve: (value: boolean) => void;
} | null = null;

/**
 * Cloud write that respects the current authenticated identity.
 *
 * Firebase rules require `request.auth.token.email == 'kazeme.javad@gmail.com'`
 * (owner Google account) for writes. Anonymous users are read-only.
 * This write:
 *  - If the owner is currently signed in with Google (auth.currentUser.email ==
 *    the owner allow-listed address), writes as that user → global, server-authorised
 *    persistence on Firestore.
 *  - Otherwise the write is rejected by the rules and this returns false
 *    (no silent success, no stale misreporting).
 */
async function executeCloudWrite(
  properties: PropertyListing[],
  config?: PluginConfig,
  selectedPropertyId?: string,
  activeRoomId?: string
): Promise<boolean> {
  try {
    if (!isOwnerGoogleUser()) {
      // Not signed in as the owner. We deliberately do NOT claim a successful
      // cloud save — this keeps anonymous save attempts from overwriting
      // settings on remote devices or creating invalid ownership claims.
      console.warn(
        '[Firebase Firestore] Cloud write rejected (not signed in as owner ' +
        'kazeme.javad@gmail.com) - saving only to local storage/backend.'
      );
      return false;
    }
    await ensureAuth();
    const docRef = doc(db, 'tour_data', MASTER_DOC_PATH);
    // Build the payload without undefined fields — Firestore rejects undefined
    // values even with { merge: true }, which would silently kill the write.
    const payload: Partial<CloudTourData> & { updatedAt: string; schemaVersion: number } = {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      updatedAt: new Date().toISOString()
    };
    if (Array.isArray(properties) && properties.length > 0) payload.properties = properties;
    if (config) payload.config = config;
    if (selectedPropertyId) payload.selectedPropertyId = selectedPropertyId;
    if (activeRoomId) payload.activeRoomId = activeRoomId;
    await setDoc(docRef, payload as CloudTourData, { merge: true });
    return true;
  } catch (err: any) {
    console.warn('[Firebase Firestore] Notice while saving to cloud (local storage active):', err?.message || err);
    return false;
  }
}

// Save complete tour dataset to Firebase Cloud Firestore with throttling
export function saveCloudTourData(
  properties: PropertyListing[],
  config?: PluginConfig,
  selectedPropertyId?: string,
  activeRoomId?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    // If a write is currently inflight, coalesce into pending
    if (isSaving) {
      if (pendingData) {
        pendingData.resolve(false);
      }
      pendingData = { properties, config, selectedPropertyId, activeRoomId, resolve };
      return;
    }

    // Debounce rapid calls to prevent backend overload
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      saveTimeout = null;
      isSaving = true;
      try {
        const result = await executeCloudWrite(properties, config, selectedPropertyId, activeRoomId);
        resolve(result);
      } finally {
        isSaving = false;
        // If another save was queued during execution, process the latest payload
        if (pendingData) {
          const next = pendingData;
          pendingData = null;
          saveCloudTourData(next.properties, next.config, next.selectedPropertyId, next.activeRoomId).then(next.resolve);
        }
      }
    }, 1000);
  });
}

// Subscribe to real-time updates from Firebase Cloud Firestore
export function subscribeToCloudTourData(
  callback: (data: CloudTourData) => void
): Unsubscribe | null {
  try {
    const docRef = doc(db, 'tour_data', MASTER_DOC_PATH);
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CloudTourData;
          // Ignore stale cloud documents written before the current schema version
          if (Array.isArray(data.properties) && data.properties.length > 0 && data.schemaVersion === CLOUD_SCHEMA_VERSION) {
            callback(data);
          }
        }
      },
      (err) => {
        console.warn('[Firebase Firestore] Realtime subscription error:', err);
      }
    );
  } catch (err) {
    console.warn('[Firebase Firestore] Could not create snapshot listener:', err);
    return null;
  }
}
