import { AdminUser, AuthState } from '../types';
import {
  signInWithGoogle as fbSignInWithGoogle,
  signOutGoogle as fbSignOut,
  onGoogleAuthChange,
  ADMIN_EMAILS
} from '../firebaseAuth';

const STORAGE_SESSION_KEY = 'vbt_admin_session_v2';
const OWNER_CREDENTIAL_KEY = 'vbt_owner_credential_v1';

/**
 * SECURITY MODEL
 * --------------
 * Two independent admin paths:
 *  1) Owner Key  — registration + password stored ONLY on this device
 *     (PBKDF2-hashed with a per-device salt). Works with zero network
 *     access: no Google, no VPN needed. Protects the admin UI.
 *  2) Google     — real Firebase sign-in with the allow-listed owner
 *     Gmail. Unlocks cloud writes (protected server-side by
 *     firestore.rules). Needed only for saving tour data to Firestore.
 * Visitors get neither: the Owner Key registration email is locked to
 * ADMIN_EMAILS and Firestore rejects every other writer.
 */

export interface AuthResult {
  success: boolean;
  error?: string;   // technical / English
  errorFa?: string; // human-readable Persian
  user?: AdminUser;
  recoveryKey?: string; // returned ONCE by registerOwner
}

interface OwnerCredential {
  email: string;
  salt: string;
  passwordHash: string;
  recoveryHash: string;
  createdAt: string;
  hashVersion: 'pbkdf2' | 'fallback';
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

function generateRecoveryKey(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const chars = Array.from(arr).map(n => alphabet[n % alphabet.length]);
  return `VBT-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12, 16).join('')}`;
}

async function deriveHash(secret: string, salt: string, domain: string): Promise<{ hash: string; version: 'pbkdf2' | 'fallback' }> {
  const input = `${domain}::${salt}::${secret}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(input), iterations: 120000, hash: 'SHA-256' },
        key,
        256
      );
      return { hash: toHex(bits), version: 'pbkdf2' };
    }
  } catch {
    // fall through to fallback
  }
  // Fallback for non-secure contexts (file://) where crypto.subtle is unavailable
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = `${input}#${input}`;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + s.charCodeAt(i) + i, 2246822519) >>> 0;
  }
  for (let r = 0; r < 4096; r++) {
    h1 = Math.imul(h1 ^ r, 16777619) >>> 0;
    h2 = Math.imul(h2 + h1, 2246822519) >>> 0;
  }
  return { hash: `fb:${h1.toString(16)}:${h2.toString(16)}`, version: 'fallback' };
}

function readOwnerCredential(): OwnerCredential | null {
  try {
    const raw = localStorage.getItem(OWNER_CREDENTIAL_KEY);
    if (!raw) return null;
    const cred = JSON.parse(raw) as OwnerCredential;
    if (cred && cred.email && cred.salt && cred.passwordHash && cred.recoveryHash) return cred;
  } catch {
    // ignore
  }
  return null;
}

function writeOwnerCredential(cred: OwnerCredential): void {
  localStorage.setItem(OWNER_CREDENTIAL_KEY, JSON.stringify(cred));
}

function nowStamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export const authService = {
  // ───────────────────────── Owner Key account ─────────────────────────

  getOwnerCredential(): OwnerCredential | null {
    return readOwnerCredential();
  },

  hasOwnerAccount(): boolean {
    return readOwnerCredential() !== null;
  },

  async registerOwner(email: string, password: string): Promise<AuthResult> {
    const clean = (email || '').trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(clean)) {
      return {
        success: false,
        errorFa: 'ثبت‌نام فقط با جیمیل مالک مجاز است: kazeme.javad@gmail.com',
        error: 'Only the owner Gmail may register as admin.'
      };
    }
    if (!password || password.length < 8) {
      return {
        success: false,
        errorFa: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
        error: 'Password must be at least 8 characters.'
      };
    }
    if (readOwnerCredential()) {
      return {
        success: false,
        errorFa: 'حساب مدیر روی این دستگاه از قبل ساخته شده است.',
        error: 'An owner account already exists on this device.'
      };
    }
    const salt = randomHex(16);
    const passwordHash = await deriveHash(password, salt, 'password');
    const recoveryKey = generateRecoveryKey();
    const recoveryHash = await deriveHash(recoveryKey, salt, 'recovery');
    writeOwnerCredential({
      email: clean,
      salt,
      passwordHash: passwordHash.hash,
      recoveryHash: recoveryHash.hash,
      createdAt: new Date().toISOString(),
      hashVersion: passwordHash.version
    });
    return { success: true, recoveryKey };
  },

  async loginWithOwner(email: string, password: string): Promise<AuthResult> {
    const cred = readOwnerCredential();
    if (!cred) {
      return {
        success: false,
        errorFa: 'هنوز حساب مدیری روی این دستگاه ساخته نشده — اول ثبت‌نام کنید.',
        error: 'No owner account registered on this device.'
      };
    }
    const clean = (email || '').trim().toLowerCase();
    if (clean !== cred.email) {
      return {
        success: false,
        errorFa: 'ایمیل با حساب مدیر ثبت‌شده مطابقت ندارد.',
        error: 'Email does not match the registered owner account.'
      };
    }
    const attempt = await deriveHash(password, cred.salt, 'password');
    if (attempt.hash !== cred.passwordHash) {
      return {
        success: false,
        errorFa: 'رمز عبور اشتباه است.',
        error: 'Incorrect password.'
      };
    }
    const adminUser: AdminUser = {
      username: clean.split('@')[0],
      email: clean,
      displayName: 'Javad Kazemi',
      role: 'Super Admin',
      authProvider: 'owner-key',
      avatar: '',
      lastLogin: nowStamp()
    };
    this.setSession(adminUser);
    return { success: true, user: adminUser };
  },

  async changeOwnerPassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    const cred = readOwnerCredential();
    if (!cred) {
      return { success: false, errorFa: 'حساب مدیر وجود ندارد.', error: 'No owner account.' };
    }
    const current = await deriveHash(currentPassword, cred.salt, 'password');
    if (current.hash !== cred.passwordHash) {
      return { success: false, errorFa: 'رمز فعلی اشتباه است.', error: 'Current password is incorrect.' };
    }
    if (!newPassword || newPassword.length < 8) {
      return { success: false, errorFa: 'رمز جدید باید حداقل ۸ کاراکتر باشد.', error: 'New password must be at least 8 characters.' };
    }
    const next = await deriveHash(newPassword, cred.salt, 'password');
    writeOwnerCredential({ ...cred, passwordHash: next.hash, hashVersion: next.version });
    return { success: true };
  },

  async resetOwnerPasswordWithRecoveryKey(recoveryKey: string, newPassword: string): Promise<AuthResult> {
    const cred = readOwnerCredential();
    if (!cred) {
      return { success: false, errorFa: 'حساب مدیر وجود ندارد.', error: 'No owner account.' };
    }
    if (!newPassword || newPassword.length < 8) {
      return { success: false, errorFa: 'رمز جدید باید حداقل ۸ کاراکتر باشد.', error: 'New password must be at least 8 characters.' };
    }
    const normalized = (recoveryKey || '').trim().toUpperCase().replace(/\s+/g, '');
    const attempt = await deriveHash(normalized, cred.salt, 'recovery');
    if (attempt.hash !== cred.recoveryHash) {
      return { success: false, errorFa: 'کد بازیابی اشتباه است.', error: 'Invalid recovery key.' };
    }
    const next = await deriveHash(newPassword, cred.salt, 'password');
    writeOwnerCredential({ ...cred, passwordHash: next.hash, hashVersion: next.version });
    return { success: true };
  },

  // ───────────────────────── Google (cloud path) ─────────────────────────

  async loginWithGoogle(): Promise<AuthResult> {
    try {
      const result = await fbSignInWithGoogle();
      const email = (result?.email || '').toLowerCase();
      if (!ADMIN_EMAILS.includes(email)) {
        await fbSignOut();
        return {
          success: false,
          errorFa: 'این حساب گوگل مجاز به دسترسی ادمین نیست.',
          error: 'This Google account is not authorized for admin access.'
        };
      }
      const adminUser: AdminUser = {
        username: email.split('@')[0],
        email,
        displayName: result?.displayName || 'Administrator',
        role: 'Super Admin',
        authProvider: 'google',
        avatar: result?.photoURL || '',
        lastLogin: nowStamp()
      };
      this.setSession(adminUser);
      return { success: true, user: adminUser };
    } catch (err: any) {
      const code = err?.code || '';
      if (code.includes('network-request-failed')) {
        return {
          success: false,
          errorFa: 'اتصال به سرورهای گوگل برقرار نشد (تحریم/فیلترینگ). با VPN امتحان کنید یا از «کلید مدیر» استفاده کنید.',
          error: 'auth/network-request-failed — Google servers unreachable. Use Owner Key sign-in or a VPN.'
        };
      }
      if (code.includes('popup-closed')) {
        return { success: false, errorFa: 'پنجره ورود گوگل قبل از اتمام بسته شد.', error: 'Sign-in popup was closed before finishing.' };
      }
      if (code.includes('cancelled-popup')) {
        return { success: false, errorFa: 'ورود با گوگل لغو شد.', error: 'Sign-in was cancelled.' };
      }
      if (code.includes('popup-blocked')) {
        return { success: false, errorFa: 'مرورگر پنجره گوگل را بلاک کرد — popup را مجاز کنید.', error: 'Browser blocked the popup — allow popups and retry.' };
      }
      if (code.includes('unauthorized-domain')) {
        return {
          success: false,
          errorFa: 'این دامنه در کنسول Firebase مجاز نیست (Authentication → Settings → Authorized domains).',
          error: 'This domain is not authorized in Firebase console.'
        };
      }
      if (code.includes('operation-not-allowed')) {
        return {
          success: false,
          errorFa: 'ورود با گوگل در کنسول Firebase فعال نشده است.',
          error: 'Google Sign-In provider is disabled in Firebase console.'
        };
      }
      return { success: false, errorFa: 'ورود با گوگل ناموفق بود.', error: err?.message || 'Google sign-in failed.' };
    }
  },

  // ───────────────────────── Session plumbing ─────────────────────────

  subscribeToAuth(cb: (state: AuthState) => void): () => void {
    return onGoogleAuthChange((fbUser) => {
      if (fbUser && ADMIN_EMAILS.includes((fbUser.email || '').toLowerCase())) {
        const adminUser: AdminUser = {
          username: (fbUser.email || '').split('@')[0],
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Administrator',
          role: 'Super Admin',
          authProvider: 'google',
          avatar: fbUser.photoURL || '',
          lastLogin: nowStamp()
        };
        this.setSession(adminUser);
        cb({ isAuthenticated: true, user: adminUser });
        return;
      }
      // No allow-listed Google user — keep a local Owner Key session alive
      const local = this.getSession();
      if (local.isAuthenticated && local.user && local.user.authProvider === 'owner-key') {
        cb({ isAuthenticated: true, user: local.user });
        return;
      }
      this.clearSession();
      cb({ isAuthenticated: false, user: null });
    });
  },

  getSession(): AuthState {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as AuthState;
        if (session && session.isAuthenticated && session.user) {
          return session;
        }
      }
    } catch {
      // Fallback
    }
    return { isAuthenticated: false, user: null };
  },

  setSession(user: AdminUser): void {
    try {
      const session: AuthState = { isAuthenticated: true, user };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save session', e);
    }
  },

  clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // Ignore
    }
  },

  logout(): void {
    this.clearSession();
    fbSignOut().catch(() => {});
  }
};
