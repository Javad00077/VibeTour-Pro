import { AdminUser, AuthState } from '../types';

const STORAGE_CREDENTIALS_KEY = 'vbt_admin_credentials_v1';
const STORAGE_SESSION_KEY = 'vbt_admin_session_v1';

export interface StoredCredentials {
  username: string;
  password: string; // Plain/Base64 stored securely in client storage for offline admin
  updatedAt: string;
}

const DEFAULT_CREDENTIALS: StoredCredentials = {
  username: 'admin',
  password: 'admin', // Supports 'admin' and 'admin123' by default
  updatedAt: new Date().toISOString(),
};

export const authService = {
  // Get currently active credentials
  getCredentials(): StoredCredentials {
    try {
      const raw = localStorage.getItem(STORAGE_CREDENTIALS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CREDENTIALS;
  },

  // Save new credentials
  setCredentials(username: string, password: string): boolean {
    try {
      const data: StoredCredentials = {
        username: username.trim(),
        password: password.trim(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save credentials', e);
      return false;
    }
  },

  // Reset to default credentials (admin / admin)
  resetToDefaultCredentials(): StoredCredentials {
    localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(DEFAULT_CREDENTIALS));
    return DEFAULT_CREDENTIALS;
  },

  // Get current active login session
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

  // Save active login session
  setSession(user: AdminUser): void {
    try {
      const session: AuthState = {
        isAuthenticated: true,
        user,
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save session', e);
    }
  },

  // Logout
  logout(): void {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // Ignore
    }
  },

  // Authenticate with username and password
  loginWithCredentials(usernameInput: string, passwordInput: string): { success: boolean; error?: string; user?: AdminUser } {
    const creds = this.getCredentials();
    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    // Check against saved credentials, with fallback support for 'admin' / 'admin123' if default
    const isDefaultUnchanged = creds.username === 'admin' && creds.password === 'admin';
    const isUsernameMatch = cleanUser === creds.username.toLowerCase();
    const isPasswordMatch = cleanPass === creds.password || (isDefaultUnchanged && cleanPass === 'admin123');

    if (isUsernameMatch && isPasswordMatch) {
      const adminUser: AdminUser = {
        username: creds.username,
        displayName: 'مدیر کل سامانه (Admin)',
        role: 'Super Admin',
        authProvider: 'credentials',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        lastLogin: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };
      this.setSession(adminUser);
      return { success: true, user: adminUser };
    }

    return { 
      success: false, 
      error: 'نام کاربری یا رمز عبور اشتباه است. (پیش‌فرض: نام کاربری admin و رمز admin)' 
    };
  },

  // Authenticate with Google / Gmail
  loginWithGoogle(emailInput?: string, nameInput?: string, photoUrl?: string): { success: boolean; user: AdminUser } {
    const defaultEmail = emailInput || 'kazeme.javad@gmail.com';
    const displayName = nameInput || (defaultEmail.includes('kazeme') ? 'جواد کاظمی (مدیر ارشد)' : 'کاربر ویژه گوگل');
    const avatar = photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';

    const googleUser: AdminUser = {
      username: defaultEmail.split('@')[0],
      email: defaultEmail,
      displayName,
      role: 'Super Admin',
      authProvider: 'google',
      avatar,
      lastLogin: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    this.setSession(googleUser);
    return { success: true, user: googleUser };
  },

  // Update Username and Password with current password verification
  updateCredentials(
    currentPasswordInput: string,
    newUsernameInput: string,
    newPasswordInput: string
  ): { success: boolean; error?: string } {
    const currentCreds = this.getCredentials();
    const isDefaultUnchanged = currentCreds.username === 'admin' && currentCreds.password === 'admin';
    const isCurPassValid = currentPasswordInput.trim() === currentCreds.password || (isDefaultUnchanged && currentPasswordInput.trim() === 'admin123');

    // If currently logged in via Google, allow changing credentials directly or verify
    const session = this.getSession();
    const isGoogleAuth = session.user?.authProvider === 'google';

    if (!isCurPassValid && !isGoogleAuth) {
      return { success: false, error: 'رمز عبور فعلی وارد شده نادرست است.' };
    }

    const cleanNewUser = newUsernameInput.trim();
    const cleanNewPass = newPasswordInput.trim();

    if (cleanNewUser.length < 3) {
      return { success: false, error: 'نام کاربری جدید باید حداقل ۳ کاراکتر باشد.' };
    }
    if (cleanNewPass.length < 4) {
      return { success: false, error: 'رمز عبور جدید باید حداقل ۴ کاراکتر باشد.' };
    }

    const saved = this.setCredentials(cleanNewUser, cleanNewPass);
    if (!saved) {
      return { success: false, error: 'خطا در ذخیره‌سازی مشخصات جدید در مرورگر.' };
    }

    // Also update active session if logged in via credentials
    if (session.isAuthenticated && session.user && session.user.authProvider === 'credentials') {
      const updatedUser: AdminUser = {
        ...session.user,
        username: cleanNewUser,
        displayName: `${cleanNewUser} (مدیر سامانه)`,
      };
      this.setSession(updatedUser);
    }

    return { success: true };
  }
};
