import { AdminUser, AuthState } from '../types';
import {
  signInWithGoogle as fbSignInWithGoogle,
  signOutGoogle as fbSignOut,
  onGoogleAuthChange,
  ADMIN_EMAILS
} from '../firebaseAuth';

const STORAGE_SESSION_KEY = 'vbt_admin_session_v2';

/**
 * SECURITY MODEL
 * --------------
 * Admin access is gated by REAL Firebase Google Sign-In. Only the email
 * addresses listed in ADMIN_EMAILS (firebaseAuth.ts) may ever become admin.
 * No client-side credentials, no shared passwords, no spoofable sessions:
 * the session is re-verified against the live Firebase user on every load.
 */

export const authService = {
  // Live-subscribe to real Firebase auth state; resolves admin only for allow-listed emails
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
          lastLogin: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
        this.setSession(adminUser);
        cb({ isAuthenticated: true, user: adminUser });
      } else {
        // Signed out, or a non-owner Google account — never admin
        this.clearSession();
        cb({ isAuthenticated: false, user: null });
      }
    });
  },

  // Real Google Sign-In popup through Firebase Auth
  async loginWithGoogle(): Promise<{ success: boolean; error?: string; user?: AdminUser }> {
    try {
      const result = await fbSignInWithGoogle();
      const email = (result?.email || '').toLowerCase();
      if (!ADMIN_EMAILS.includes(email)) {
        // Immediately sign the unauthorized visitor back out
        await fbSignOut();
        return {
          success: false,
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
        lastLogin: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
      this.setSession(adminUser);
      return { success: true, user: adminUser };
    } catch (err: any) {
      const code = err?.code || '';
      if (code.includes('popup-closed')) {
        return { success: false, error: 'Sign-in popup was closed before finishing.' };
      }
      if (code.includes('cancelled-popup')) {
        return { success: false, error: 'Sign-in was cancelled.' };
      }
      if (code.includes('popup-blocked')) {
        return { success: false, error: 'Browser blocked the popup — allow popups and retry.' };
      }
      if (code.includes('unauthorized-domain')) {
        return { success: false, error: 'This domain is not authorized in Firebase console (Authentication → Settings → Authorized domains).' };
      }
      if (code.includes('operation-not-allowed')) {
        return { success: false, error: 'Google Sign-In provider is disabled in Firebase console.' };
      }
      return { success: false, error: err?.message || 'Google sign-in failed.' };
    }
  },

  // Get cached session (instant UI); still re-verified live by subscribeToAuth
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

  // Kept for API compatibility — credentials login is fully disabled
  logout(): void {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // Ignore
    }
    fbSignOut().catch(() => {});
  }
};
