import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * ─────────────────────────────────────────────────────────────
 *  OWNER ALLOWLIST — the ONLY Google accounts that can ever
 *  obtain admin rights. Everyone else browsing the tour is a
 *  read-only visitor and can NEVER reach the admin panel.
 * ─────────────────────────────────────────────────────────────
 */
export const ADMIN_EMAILS: string[] = [
  'kazeme.javad@gmail.com'
];

export interface GoogleSignInResult {
  email: string;
  displayName: string;
  photoURL: string;
}

// Real Google Sign-In popup (Firebase Auth)
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const u: User = cred.user;
  return {
    email: u.email || '',
    displayName: u.displayName || '',
    photoURL: u.photoURL || ''
  };
}

// Sign the current user out of Firebase
export async function signOutGoogle(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // already signed out
  }
}

// Live subscription to Firebase auth state (fires immediately with current user)
export function onGoogleAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// Whether the currently signed-in Firebase user is the owner Google account
// (the only account allowed to write global tour settings to Firestore).
export function isOwnerGoogleUser(){
  const u = auth.currentUser;
  if (!u || !u.email) return false;
  return (u.email || '').toLowerCase() === ADMIN_EMAILS[0].toLowerCase();
}
