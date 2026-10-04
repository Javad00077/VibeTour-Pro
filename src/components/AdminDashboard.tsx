import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Key,
  User,
  Mail,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Film,
  Building,
  Sliders,
  LogOut,
  Save,
  RotateCcw,
  Check,
  Compass,
  ArrowRight,
  ExternalLink,
  Layers,
  DoorOpen,
  Gauge,
  Plus,
  Trash2,
  Image as ImageIcon,
  Video,
  FileJson,
  Download,
  Upload,
  Copy,
  Building2,
  Phone,
  Briefcase,
  FolderArchive,
  TrendingUp,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Globe,
  HardDrive,
  X,
  Laptop,
  Cloud
} from 'lucide-react';
import { PropertyListing, Room, PluginConfig, AdminUser, Hotspot, MaterialItem, ActiveTab } from '../types';
import { authService } from '../utils/authService';
import { ensureAuth, auth } from '../firebase';
import { isOwnerGoogleUser } from '../firebaseAuth';
import { StorageService, getLastCloudSaveOutcome, getLastEditTimestamp } from '../services/storageService';
import {
  getStoredPat,
  setStoredPat,
  hasStoredPat,
  publishGlobalTourData,
  probePublishedState,
  PublishResult,
  PublishedProbe
} from '../services/globalPublishService';
import { MediaLibraryModal, SAMPLE_WP_MEDIA } from './MediaLibraryModal';
import { soundEngine } from '../utils/audioSynth';
import { analyzeAndConvertVideoUrl, VideoUrlAnalysis, isStaticHost } from '../utils/videoUrlHelper';

interface AdminDashboardProps {
  properties: PropertyListing[];
  currentProperty: PropertyListing;
  config: PluginConfig;
  onUpdateProperty: (updated: PropertyListing) => void;
  onSelectProperty: (property: PropertyListing) => void;
  onAddProperty?: (newProp: PropertyListing) => void;
  onDeleteProperty?: (id: string) => void;
  onUpdateConfig: (newConfig: PluginConfig) => void;
  onNavigateToWalkthrough: () => void;
  onSelectTab?: (tab: ActiveTab) => void;
  onAuthChange?: (isAuthenticated: boolean) => void;
}

type AdminTab = 'profiles' | 'facade' | 'videos' | 'motion' | 'tools' | 'security';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  properties,
  currentProperty,
  config,
  onUpdateProperty,
  onSelectProperty,
  onAddProperty,
  onDeleteProperty,
  onUpdateConfig,
  onNavigateToWalkthrough,
  onSelectTab,
  onAuthChange
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  // Login Form States — dual path: Owner Key (offline) + Google (cloud)
  const [loginMode, setLoginMode] = useState<'owner' | 'google'>('owner');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginErrorEn, setLoginErrorEn] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  // Owner Key account (registration / sign-in / recovery) — device-local, no network
  const [hasOwnerAccount, setHasOwnerAccount] = useState<boolean>(() => authService.hasOwnerAccount());
  const [ownerEmail, setOwnerEmail] = useState<string>('kazeme.javad@gmail.com');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [ownerConfirm, setOwnerConfirm] = useState<string>('');
  const [ownerRecoveryInput, setOwnerRecoveryInput] = useState<string>('');
  const [ownerResetMode, setOwnerResetMode] = useState<boolean>(false);
  const [freshRecoveryKey, setFreshRecoveryKey] = useState<string | null>(null);
  const [recoveryAck, setRecoveryAck] = useState<boolean>(false);
  // Security tab — change password
  const [secCurrent, setSecCurrent] = useState<string>('');
  const [secNew, setSecNew] = useState<string>('');
  const [secConfirm, setSecConfirm] = useState<string>('');
  // Real sync state. 'cloud' = owner signed in with Google (Firestore writes
  // allowed), 'github' = a GitHub token is configured (global publish works
  // without Google), 'local' = neither, so saves stay on this device only.
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'cloud' | 'github' | 'local'>('checking');
  // What the live site currently serves (published tour data + credential)
  const [published, setPublished] = useState<PublishedProbe | null>(null);
  // True when local edits are newer than what the live site serves — this is the
  // exact condition that makes other devices/visitors show the wrong content.
  const [pendingPublish, setPendingPublish] = useState<boolean>(false);
  // New-device sign-in (cross-device account restore): register / restore / recovery
  const [deviceLoginMode, setDeviceLoginMode] = useState<'register' | 'restore' | 'recovery'>('register');
  const [restorePassword, setRestorePassword] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  // GitHub Publish (Tools tab) — PAT stored only in this browser's localStorage
  const [ghPat, setGhPat] = useState<string>(() => getStoredPat());
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Dashboard Active Tab
  const [adminTab, setAdminTab] = useState<AdminTab>('profiles');

  // Saving All to Storage State
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Media Library Modal
  const [showMediaModal, setShowMediaModal] = useState<boolean>(false);
  const [mediaTargetField, setMediaTargetField] = useState<{ type: 'propertyHero' | 'roomVideo' | 'roomThumb' | 'brokerAvatar' | 'newProfileHero'; roomId?: string } | null>(null);

  // New Property Profile Creation Modal States
  const [showAddProfileModal, setShowAddProfileModal] = useState<boolean>(false);
  const [newPropTitle, setNewPropTitle] = useState<string>('');
  const [newPropTitleFa, setNewPropTitleFa] = useState<string>('');
  const [newPropPrice, setNewPropPrice] = useState<string>('$38,500,000');
  const [newPropLocation, setNewPropLocation] = useState<string>('Beverly Hills, California');
  const [newPropBeds, setNewPropBeds] = useState<number>(5);
  const [newPropBaths, setNewPropBaths] = useState<number>(6);
  const [newPropSqft, setNewPropSqft] = useState<number>(10800);
  const [newPropHero, setNewPropHero] = useState<string>('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80');

  // Selected Room for Video Editor
  const [selectedRoomId, setSelectedRoomId] = useState<string>(currentProperty.rooms[0]?.id || '');
  const selectedRoom = currentProperty.rooms.find((r) => r.id === selectedRoomId) || currentProperty.rooms[0];

  // Video Hosting Guide & Converter Modal States
  const [showVideoHostingModal, setShowVideoHostingModal] = useState<boolean>(false);
  const [hostingGuideTab, setHostingGuideTab] = useState<'github' | 'gdrive' | 'devices'>('devices');
  const [converterInputUrl, setConverterInputUrl] = useState<string>('');
  const [copiedTsCode, setCopiedTsCode] = useState<boolean>(false);
  const [copiedJsonCode, setCopiedJsonCode] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Initialize session on mount + live-verify against real Firebase auth state
  useEffect(() => {
    const session = authService.getSession();
    if (session.isAuthenticated && session.user) {
      setIsAuthenticated(true);
      setCurrentUser(session.user);
    }
    // Live subscription: session is invalid the moment Firebase signs the user out
    const unsub = authService.subscribeToAuth((state) => {
      setIsAuthenticated(state.isAuthenticated);
      setCurrentUser(state.user);
      if (state.isAuthenticated && state.user) {
        if (onAuthChange) onAuthChange(true);
      } else {
        if (onAuthChange) onAuthChange(false);
      }
    });
    return () => unsub && unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    soundEngine.triggerHapticChime(580);
    setTimeout(() => setToastMessage(null), 3500);
  };  // Login with Google — REAL Firebase popup, allow-list verified
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);

    const res = await authService.loginWithGoogle();
    if (res.success && res.user) {
      setIsAuthenticated(true);
      setCurrentUser(res.user);
      if (onAuthChange) onAuthChange(true);
      showToast(`Signed in as ${res.user.email}`);
    } else {
      setLoginError(res.errorFa || res.error || 'Google sign-in failed.');
      setLoginErrorEn(res.error || null);
      soundEngine.triggerHapticChime(320);
    }
    setIsLoggingIn(false);
  };

  // Logout — clears Firebase session everywhere
  const handleLogout = async () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    if (onAuthChange) onAuthChange(false);
    showToast('Signed out successfully.');
  };

  // Resolve the effective sync channel and read what the live site serves.
  // Runs after the anonymous Firebase auth settles and again whenever the
  // sign-in method or the stored GitHub token changes.
  useEffect(() => {
    let cancelled = false;
    ensureAuth().finally(() => {
      setTimeout(() => {
        if (cancelled) return;
        if (isOwnerGoogleUser()) setCloudStatus('cloud');
        else if (hasStoredPat()) setCloudStatus('github');
        else setCloudStatus('local');
      }, 900);
    });
    probePublishedState().then((probe) => {
      if (!cancelled) setPublished(probe);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser?.authProvider, ghPat]);

  const setAuthError = (fa: string | undefined, en: string | undefined) => {
    setLoginError(fa || en || 'خطای نامشخص.');
    setLoginErrorEn(en || null);
  };

  // ── Owner Key account: register / login / reset (100% offline, no Google) ──
  const handleOwnerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginErrorEn(null);
    if (ownerPassword !== ownerConfirm) {
      setAuthError('رمز عبور با تکرار آن مطابقت ندارد.', 'Password and confirmation do not match.');
      soundEngine.triggerHapticChime(320);
      return;
    }
    setIsLoggingIn(true);
    const res = await authService.registerOwner(ownerEmail, ownerPassword);
    setIsLoggingIn(false);
    if (res.success && res.recoveryKey) {
      setHasOwnerAccount(true);
      setFreshRecoveryKey(res.recoveryKey);
      setRecoveryAck(false);
      setOwnerPassword('');
      setOwnerConfirm('');
      soundEngine.triggerHapticChime(660);
    } else {
      setAuthError(res.errorFa, res.error);
      soundEngine.triggerHapticChime(320);
    }
  };

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginErrorEn(null);
    setIsLoggingIn(true);
    const res = await authService.loginWithOwner(ownerEmail, ownerPassword);
    setIsLoggingIn(false);
    if (res.success && res.user) {
      setIsAuthenticated(true);
      setCurrentUser(res.user);
      if (onAuthChange) onAuthChange(true);
      showToast(`خوش آمدید — ${res.user.email}`);
    } else {
      setAuthError(res.errorFa, res.error);
      soundEngine.triggerHapticChime(320);
    }
  };

  const handleOwnerReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginErrorEn(null);
    if (ownerPassword !== ownerConfirm) {
      setAuthError('رمز عبور با تکرار آن مطابقت ندارد.', 'Password and confirmation do not match.');
      return;
    }
    setIsLoggingIn(true);
    const res = await authService.resetOwnerPasswordWithRecoveryKey(ownerRecoveryInput, ownerPassword);
    setIsLoggingIn(false);
    if (res.success) {
      setOwnerResetMode(false);
      setOwnerRecoveryInput('');
      setOwnerPassword('');
      setOwnerConfirm('');
      showToast('رمز با موفقیت بازنشانی شد — حالا وارد شوید.');
    } else {
      setAuthError(res.errorFa, res.error);
      soundEngine.triggerHapticChime(320);
    }
  };

  // ── New-device sign-in: restore the SAME owner account from the published credential ──
  const handleOwnerRestoreFromCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginErrorEn(null);
    setIsRestoring(true);
    const res = await authService.restoreOwnerFromCloud(restorePassword);
    setIsRestoring(false);
    if (res.success && res.user) {
      setHasOwnerAccount(true);
      setIsAuthenticated(true);
      setCurrentUser(res.user);
      if (onAuthChange) onAuthChange(true);
      setRestorePassword('');
      showToast(`حساب مدیر روی این دستگاه بازیابی شد — ${res.user.email}`);
    } else {
      setAuthError(res.errorFa, res.error);
      soundEngine.triggerHapticChime(320);
    }
  };

  // ── New-device sign-in: reclaim the single identity with the recovery key (offline) ──
  const handleOwnerReclaimWithRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginErrorEn(null);
    if (ownerPassword !== ownerConfirm) {
      setAuthError('رمز عبور با تکرار آن مطابقت ندارد.', 'Password and confirmation do not match.');
      return;
    }
    setIsRestoring(true);
    const res = await authService.loginWithRecoveryKeyOnNewDevice(ownerEmail, ownerRecoveryInput, ownerPassword);
    setIsRestoring(false);
    if (res.success && res.user) {
      setHasOwnerAccount(true);
      setIsAuthenticated(true);
      setCurrentUser(res.user);
      if (onAuthChange) onAuthChange(true);
      setOwnerPassword('');
      setOwnerConfirm('');
      setOwnerRecoveryInput('');
      showToast('حساب مدیر با کد بازیابی روی این دستگاه فعال شد.');
    } else {
      setAuthError(res.errorFa, res.error);
      soundEngine.triggerHapticChime(320);
    }
  };

  // ── GitHub Publish: commit tour-data.json + admin-credential.json via the GitHub Contents API ──
  // The PAT is user-supplied and stays in this browser's localStorage. It gives the
  // static site its global data store: every visitor reads these committed files.
  const handleGitHubPublish = async (): Promise<PublishResult | null> => {
    const token = ghPat.trim();
    if (!token) {
      showToast('ابتدا توکن گیت‌هاب (PAT) را وارد کنید.');
      return null;
    }
    setStoredPat(token);
    setIsPublishing(true);
    try {
      const result = await publishGlobalTourData({
        properties,
        config,
        credential: authService.getOwnerCredential(),
        token
      });
      if (result.ok) {
        showToast('منتشر شد! اجرای Actions را صبر کنید (۱ تا ۲ دقیقه) — سپس تنظیمات همه‌جا اعمال می‌شود.');
        soundEngine.triggerHapticChime(660);
      } else {
        showToast(`انتشار ناموفق بود: ${result.failed[0]?.reason || 'خطای نامشخص'} — توکن و دسترسی repo را بررسی کنید.`);
        soundEngine.triggerHapticChime(320);
      }
      return result;
    } finally {
      setIsPublishing(false);
    }
  };

  // Refresh what the live site currently serves (published data + credential)
  const refreshPublishedState = useCallback(async () => {
    try {
      const probe = await probePublishedState();
      setPublished(probe);
      const localStamp = getLastEditTimestamp();
      // Pending = local edits newer than the published copy. This is precisely
      // why other devices still show the old content.
      const publishedStamp = probe.tourData.updatedAt || '';
      setPendingPublish(!!localStamp && (!publishedStamp || localStamp > publishedStamp));
    } catch {
      // offline — keep the previous reading
    }
  }, []);

  // Resolve the effective sync channel: Firestore (owner Google) or GitHub (PAT)
  const refreshSyncStatus = useCallback(() => {
    if (isOwnerGoogleUser()) setCloudStatus('cloud');
    else if (hasStoredPat()) setCloudStatus('github');
    else setCloudStatus('local');
  }, []);

  const handleCopyRecoveryKey = async () => {
    if (!freshRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(freshRecoveryKey);
      showToast('کد بازیابی کپی شد.');
    } catch {
      showToast('کپی ناموفق بود — کد را دستی یادداشت کنید.');
    }
  };

  // Security tab — change owner password
  const handleChangeOwnerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secNew !== secConfirm) {
      showToast('رمز جدید با تکرار آن مطابقت ندارد.');
      soundEngine.triggerHapticChime(320);
      return;
    }
    const res = await authService.changeOwnerPassword(secCurrent, secNew);
    if (res.success) {
      showToast('رمز مدیر با موفقیت تغییر کرد.');
      setSecCurrent('');
      setSecNew('');
      setSecConfirm('');
    } else {
      showToast(res.errorFa || res.error || 'تغییر رمز ناموفق بود.');
      soundEngine.triggerHapticChime(320);
    }
  };

  // (Credentials reset removed — admin identity is solely the allow-listed Google account)

  // Property & Facade field updater
  const handleUpdatePropertyField = (field: keyof PropertyListing, value: any) => {
    const updated = {
      ...currentProperty,
      [field]: value,
    };
    onUpdateProperty(updated);
    showToast(`Changes to field «${String(field)}» saved permanently.`);
  };

  // Room field updater
  const handleUpdateRoomField = (roomId: string, field: keyof Room, value: any) => {
    const updatedRooms = currentProperty.rooms.map((r) => {
      if (r.id === roomId) {
        return { ...r, [field]: value };
      }
      return r;
    });
    const updatedProperty = {
      ...currentProperty,
      rooms: updatedRooms,
    };
    onUpdateProperty(updatedProperty);
    showToast('Chamber and video settings updated.');
  };

  // Broker & Personnel field updater (Broker, Personnel & Contacts)
  const handleUpdateBrokerField = (field: string, value: string) => {
    const updated = {
      ...currentProperty,
      broker: {
        ...currentProperty.broker,
        [field]: value
      }
    };
    onUpdateProperty(updated);
    showToast(`Broker detail (${field}) saved permanently.`);
  };

  // Add new property profile
  const handleCreateProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropTitle.trim()) {
      showToast('Please enter a property title.');
      return;
    }
    const id = 'prop-' + Date.now();
    const clonedRooms: Room[] = currentProperty.rooms.map((r, idx) => ({
      ...r,
      id: `${id}-room-${idx + 1}`
    }));

    const newProp: PropertyListing = {
      id,
      title: newPropTitle.trim(),
      titleFa: newPropTitleFa.trim() || newPropTitle.trim(),
      subtitle: 'Ultra-Luxury Kinetic Walkthrough Residence',
      subtitleFa: 'Exclusive architectural estate with interactive tour',
      tagline: 'Exclusive Architectural Trophy Estate',
      location: newPropLocation.trim() || 'Beverly Hills, California',
      price: newPropPrice.trim() || '$30,000,000',
      numericPrice: 30000000,
      currency: '$',
      beds: newPropBeds || 4,
      baths: newPropBaths || 5,
      sqft: newPropSqft || 8500,
      mlsNumber: 'VBT-' + Math.floor(100000 + Math.random() * 900000),
      architect: 'Zaha Hadid Architects',
      yearBuilt: 2025,
      heroImage: newPropHero,
      rooms: clonedRooms,
      broker: {
        name: currentProperty.broker?.name || 'Javad Kazemi',
        title: 'Senior Vice President of Luxury Estates',
        agency: currentProperty.broker?.agency || 'VibeTour Sotheby’s Luxury',
        phone: currentProperty.broker?.phone || '+98 912 000 0000',
        email: currentProperty.broker?.email || 'kazeme.javad@gmail.com',
        avatar: currentProperty.broker?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      }
    };

    if (onAddProperty) onAddProperty(newProp);
    onSelectProperty(newProp);
    setShowAddProfileModal(false);
    setNewPropTitle('');
    setNewPropTitleFa('');
    showToast(`New property «${newProp.title}» created and activated.`);
  };

  // Duplicate an existing property profile
  const handleDuplicateProperty = (p: PropertyListing) => {
    const id = 'prop-' + Date.now();
    const dup: PropertyListing = {
      ...p,
      id,
      title: `${p.title} (Clone)`,
      titleFa: `${p.titleFa || p.title} (Duplicate)`,
      mlsNumber: 'VBT-' + Math.floor(100000 + Math.random() * 900000),
      rooms: p.rooms.map((r, idx) => ({ ...r, id: `${id}-room-${idx + 1}` }))
    };
    if (onAddProperty) onAddProperty(dup);
    onSelectProperty(dup);
    showToast('Property profile duplicated successfully.');
  };

  // Delete property profile
  const handleDeletePropertyConfirm = (id: string, name: string) => {
    if (properties.length <= 1) {
      alert('At least one property profile must remain in system.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete profile «${name}»?`)) {
      if (onDeleteProperty) onDeleteProperty(id);
      showToast(`Property profile «${name}» deleted.`);
    }
  };

  // Media Library handler
  const handleSelectMedia = (url: string) => {
    if (!mediaTargetField) return;
    if (mediaTargetField.type === 'propertyHero') {
      handleUpdatePropertyField('heroImage', url);
    } else if (mediaTargetField.type === 'brokerAvatar') {
      handleUpdateBrokerField('avatar', url);
    } else if (mediaTargetField.type === 'newProfileHero') {
      setNewPropHero(url);
    } else if (mediaTargetField.type === 'roomVideo' && mediaTargetField.roomId) {
      handleUpdateRoomField(mediaTargetField.roomId, 'videoUrl', url);
    } else if (mediaTargetField.type === 'roomThumb' && mediaTargetField.roomId) {
      handleUpdateRoomField(mediaTargetField.roomId, 'thumbnailUrl', url);
    }
    setShowMediaModal(false);
    setMediaTargetField(null);
  };

  // Export Settings as JSON
  const handleExportJSON = () => {
    const backup = {
      property: currentProperty,
      config,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibetour-config-${currentProperty.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration backup JSON downloaded successfully.');
  };

  // Export permanent public/tour-data.json for GitHub Pages & Incognito Visitors
  const handleExportPublicTourData = () => {
    const payload = {
      properties,
      config,
      selectedPropertyId: currentProperty.id,
      activeRoomId: selectedRoomId,
      updatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tour-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Permanent tour-data.json downloaded! Place in public/ folder for 100% permanent GitHub & Incognito guest access.');
  };

  // Save All: local stores + (when possible) GLOBAL publish.
  // When a GitHub token is configured this publishes tour-data.json (and the
  // owner credential) automatically, so one Save & Sync All makes the settings
  // visible on every device and visitor — no Google account required.
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      const propSaved = await StorageService.saveProperties(properties);
      const cfgSaved = await StorageService.saveConfig(config);
      await StorageService.saveActiveState(currentProperty.id, selectedRoomId);

      // Report the REAL outcome — never fake a global sync that did not happen.
      const isOwner = isOwnerGoogleUser();
      const cloudOutcome = getLastCloudSaveOutcome();
      const token = getStoredPat();

      let publish: PublishResult | null = null;
      if (token.trim()) {
        publish = await publishGlobalTourData({
          properties,
          config,
          credential: authService.getOwnerCredential(),
          token
        });
      }

      if (publish?.ok) {
        showToast(isOwner && cloudOutcome.success
          ? 'ذخیره شد — هم در فایربیس و هم روی گیت‌هاب منتشر شد (۱ دقیقه بعد همه‌جا اعمال می‌شود).'
          : 'ذخیره و انتشار سراسری انجام شد — حدود ۱ دقیقه بعد همه دستگاه‌ها و بازدیدکنندگان تنظیمات جدید را می‌بینند.');
        soundEngine.triggerHapticChime(660);
      } else if (isOwner && cloudOutcome.success) {
        showToast('ذخیره شد — تنظیمات در فایربیس منتشر شد و روی همه دستگاه‌ها اعمال می‌شود.');
      } else if (publish && !publish.ok) {
        showToast(`ذخیره محلی شد؛ انتشار سراسری ناموفق بود: ${publish.failed[0]?.reason || 'خطای نامشخص'}`);
        soundEngine.triggerHapticChime(320);
      } else if (isOwner && cloudOutcome.attempted) {
        showToast('روی این دستگاه ذخیره شد؛ انتشار ابری ناموفق بود (اتصال/VPN را بررسی و دوباره ذخیره کنید).');
      } else if (propSaved || cfgSaved) {
        showToast('فقط روی این دستگاه ذخیره شد. برای انتشار سراسری: تب ابزارها ← توکن گیت‌هاب را وارد کنید.');
      } else {
        showToast('ذخیره محلی انجام شد (سرور بک‌اند یافت نشد). برای انتشار سراسری: تب ابزارها ← توکن گیت‌هاب.');
      }
      refreshSyncStatus();
      refreshPublishedState();
    } catch {
      showToast('ذخیره‌سازی کامل نشد.');
    } finally {
      setIsSavingAll(false);
    }
  };

  // ==========================================
  // VIEW 1: AUTHENTICATION / LOGIN SCREEN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-[750px] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
        <div className="w-full max-w-xl vbt-glass-gold p-6 sm:p-8 rounded-3xl border border-[#c5a880]/50 shadow-2xl space-y-6 relative overflow-hidden">
          
          {/* Subtle glowing corner */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#c5a880]/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#c5a880]/15 border border-[#c5a880]/40 text-[#c5a880] text-xs font-mono font-bold uppercase tracking-wider">
              <Shield className="w-4 h-4 text-[#c5a880]" />
              <span>VibeTour Pro Control Center</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
              Administrator Sign In
            </h2>
            <p className="text-xs text-slate-300 font-light max-w-md mx-auto leading-relaxed" dir="rtl">
              دو مسیر ورود: «کلید مدیر» کاملاً محلی است و بدون اینترنت/گوگل کار می‌کند؛ حساب گوگل فقط برای ذخیره ابری لازم است.
            </p>
          </div>

          {/* Login Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#12141f] rounded-2xl border border-white/10 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setLoginMode('owner'); setLoginError(null); setLoginErrorEn(null); }}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${loginMode === 'owner' ? 'bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black shadow-lg font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <Key className="w-4 h-4" />
              <span>کلید مدیر / Owner Key</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('google'); setLoginError(null); setLoginErrorEn(null); }}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${loginMode === 'google' ? 'bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black shadow-lg font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <Mail className="w-4 h-4" />
              <span>گوگل / Google</span>
            </button>
          </div>

          {/* Error Message (FA + EN) */}
          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="block leading-relaxed" dir="rtl">{loginError}</span>
                {loginErrorEn && <span className="block text-[10px] text-rose-300/70 font-mono" dir="ltr">{loginErrorEn}</span>}
              </div>
            </div>
          )}

          {loginMode === 'owner' && (
            <div className="space-y-4 animate-in fade-in">
              {freshRecoveryKey ? (
                /* One-time recovery key reveal */
                <div className="p-4 rounded-2xl bg-[#141624] border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white" dir="rtl">کد بازیابی اضطراری (فقط همین یک بار نمایش داده می‌شود)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-emerald-300 tracking-wider" dir="ltr">{freshRecoveryKey}</span>
                    <button type="button" onClick={handleCopyRecoveryKey} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 transition-colors">
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed" dir="rtl">
                    این کد را در جای امن ذخیره کنید — تنها راه بازنشانی رمز در صورت فراموشی است.
                  </p>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={recoveryAck} onChange={(e) => setRecoveryAck(e.target.checked)} className="accent-[#c5a880]" />
                    <span dir="rtl">کد را در جای امن ذخیره کردم</span>
                  </label>
                  <button
                    type="button"
                    disabled={!recoveryAck}
                    onClick={() => setFreshRecoveryKey(null)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <span dir="rtl">ذخیره کردم — رفتن به صفحه ورود</span>
                  </button>
                </div>
              ) : !hasOwnerAccount ? (
                /* New-device entry: restore published account / recovery-key reclaim / first-time register */
                <div className="p-4 rounded-2xl bg-[#141624] border border-[#c5a880]/30 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <User className="w-4 h-4 text-[#c5a880]" />
                    <span className="text-xs font-bold text-white" dir="rtl">ورود مدیر روی این دستگاه</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed" dir="rtl">
                    فقط «یک حساب» وجود دارد. اگر قبلاً روی دستگاه دیگری حساب ساخته و منتشر کرده‌اید، همان حساب را اینجا بازیابی کنید — حساب جدید نسازید.
                  </p>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#12141f] rounded-xl border border-white/10 text-[10px] font-semibold">
                    <button type="button" onClick={() => { setDeviceLoginMode('restore'); setLoginError(null); setLoginErrorEn(null); }} className={`py-2 rounded-lg transition-all ${deviceLoginMode === 'restore' ? 'bg-[#c5a880] text-black font-bold' : 'text-slate-400 hover:text-white'}`} dir="rtl">ورود روی دستگاه جدید</button>
                    <button type="button" onClick={() => { setDeviceLoginMode('recovery'); setLoginError(null); setLoginErrorEn(null); }} className={`py-2 rounded-lg transition-all ${deviceLoginMode === 'recovery' ? 'bg-[#c5a880] text-black font-bold' : 'text-slate-400 hover:text-white'}`} dir="rtl">ورود با کد بازیابی</button>
                    <button type="button" onClick={() => { setDeviceLoginMode('register'); setLoginError(null); setLoginErrorEn(null); }} className={`py-2 rounded-lg transition-all ${deviceLoginMode === 'register' ? 'bg-[#c5a880] text-black font-bold' : 'text-slate-400 hover:text-white'}`} dir="rtl">ساخت حساب (اولین دستگاه)</button>
                  </div>

                  {deviceLoginMode === 'register' && (
                    <form onSubmit={handleOwnerRegister} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-300 block" dir="rtl">ایمیل مالک:</label>
                        <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-300 block" dir="rtl">رمز عبور (حداقل ۸ کاراکتر):</label>
                          <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-300 block" dir="rtl">تکرار رمز عبور:</label>
                          <input type="password" value={ownerConfirm} onChange={(e) => setOwnerConfirm(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoggingIn} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-md shadow-[#c5a880]/20">
                        <Key className="w-4 h-4" />
                        <span dir="rtl">ساخت حساب مدیر (فقط بار اول)</span>
                      </button>
                      <p className="text-[10px] text-slate-500 text-center" dir="rtl">ثبت‌نام فقط با جیمیل مالک (kazeme.javad@gmail.com) پذیرفته می‌شود. پس از ساخت، از تب ابزارها حساب را منتشر کنید تا روی سایر دستگاه‌ها قابل بازیابی باشد.</p>
                    </form>
                  )}

                  {deviceLoginMode === 'restore' && (
                    <form onSubmit={handleOwnerRestoreFromCloud} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-300 block" dir="rtl">رمز عبور حساب مدیر اصلی:</label>
                        <input type="password" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                      </div>
                      <button type="submit" disabled={isRestoring} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-md shadow-[#c5a880]/20">
                        <Cloud className="w-4 h-4" />
                        <span dir="rtl">{isRestoring ? 'در حال بازیابی…' : 'بازیابی حساب مدیر (فقط رمز)'}</span>
                      </button>
                      <p className="text-[10px] text-slate-500 text-center" dir="rtl">این گزینه حساب منتشرشده از دستگاه اصلی را می‌خواند (admin-credential.json). اگر هنوز منتشر نشده، ابتدا از دستگاه اصلی در تب ابزارها «انتشار جهانی روی گیت‌هاب» را اجرا کنید.</p>
                    </form>
                  )}

                  {deviceLoginMode === 'recovery' && (
                    <form onSubmit={handleOwnerReclaimWithRecovery} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-300 block" dir="rtl">ایمیل مالک:</label>
                        <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-300 block" dir="rtl">کد بازیابی (VBT-…):</label>
                        <input type="text" value={ownerRecoveryInput} onChange={(e) => setOwnerRecoveryInput(e.target.value)} required dir="ltr" placeholder="VBT-XXXX-XXXX-XXXX-XXXX" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono tracking-wider" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-300 block" dir="rtl">رمز جدید (≥ ۸ کاراکتر):</label>
                          <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-300 block" dir="rtl">تکرار رمز جدید:</label>
                          <input type="password" value={ownerConfirm} onChange={(e) => setOwnerConfirm(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                        </div>
                      </div>
                      <button type="submit" disabled={isRestoring} className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
                        <Key className="w-4 h-4" />
                        <span dir="rtl">{isRestoring ? 'در حال فعال‌سازی…' : 'فعال‌سازی حساب با کد بازیابی'}</span>
                      </button>
                      <p className="text-[10px] text-slate-500 text-center" dir="rtl">با کد بازیابی، همان حساب مالک روی این دستگاه بازسازی می‌شود و می‌توانید رمز جدیدی برگزینید.</p>
                    </form>
                  )}
                </div>
              ) : ownerResetMode ? (
                /* Recovery reset */
                <form onSubmit={handleOwnerReset} className="p-4 rounded-2xl bg-[#141624] border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white" dir="rtl">بازنشانی رمز با کد بازیابی</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-300 block" dir="rtl">کد بازیابی (VBT-…):</label>
                    <input type="text" value={ownerRecoveryInput} onChange={(e) => setOwnerRecoveryInput(e.target.value)} required dir="ltr" placeholder="VBT-XXXX-XXXX-XXXX-XXXX" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-400 font-mono tracking-wider" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">رمز جدید:</label>
                      <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">تکرار رمز جدید:</label>
                      <input type="password" value={ownerConfirm} onChange={(e) => setOwnerConfirm(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                  </div>
                  <button type="submit" disabled={isLoggingIn} className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs disabled:opacity-60 transition-all">
                    <span dir="rtl">بازنشانی رمز عبور</span>
                  </button>
                  <button type="button" onClick={() => { setOwnerResetMode(false); setLoginError(null); setLoginErrorEn(null); }} className="w-full text-[11px] text-slate-400 hover:text-white transition-colors" dir="rtl">
                    بازگشت به ورود
                  </button>
                </form>
              ) : (
                /* Sign in */
                <form onSubmit={handleOwnerLogin} className="p-4 rounded-2xl bg-[#141624] border border-[#c5a880]/30 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <Lock className="w-4 h-4 text-[#c5a880]" />
                    <span className="text-xs font-bold text-white" dir="rtl">ورود با کلید مدیر</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-300 block" dir="rtl">ایمیل:</label>
                    <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-300 block" dir="rtl">رمز عبور:</label>
                    <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                  </div>
                  <button type="submit" disabled={isLoggingIn} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-md shadow-[#c5a880]/20">
                    <Unlock className="w-4 h-4" />
                    <span dir="rtl">{isLoggingIn ? 'در حال ورود…' : 'ورود به داشبرد مدیریت'}</span>
                  </button>
                  <button type="button" onClick={() => { setOwnerResetMode(true); setLoginError(null); setLoginErrorEn(null); }} className="w-full text-[11px] text-slate-400 hover:text-[#c5a880] transition-colors" dir="rtl">
                    رمز را فراموش کرده‌ام — بازنشانی با کد بازیابی
                  </button>
                </form>
              )}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#c5a880] shrink-0 mt-0.5" />
                <span dir="rtl">این مسیر کاملاً روی دستگاه شما ذخیره می‌شود و بدون اینترنت هم کار می‌کند. بازدیدکنندگان نمی‌توانند حساب بسازند — ثبت‌نام فقط با جیمیل مالک پذیرفته می‌شود.</span>
              </div>
            </div>
          )}

          {loginMode === 'google' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Primary Recognized Google Card */}
              <div className="p-4 rounded-2xl bg-[#141624] border border-[#c5a880]/30 hover:border-[#c5a880] transition-all space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                      alt="Google User"
                      className="w-11 h-11 rounded-full object-cover border border-[#c5a880]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">Javad Kazemi</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                          Super Admin
                        </span>
                      </div>
                      <p className="text-xs text-[#c5a880] font-mono mt-0.5">
                        kazeme.javad@gmail.com
                      </p>
                    </div>
                  </div>

                  {/* Google G Logo */}
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={isLoggingIn}
                  className="w-full py-2.5 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#c5a880]/20"
                >
                  <Mail className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Opening Google Sign-In...' : 'Sign in with this Google account'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span dir="rtl">گوگل فقط برای «ذخیره ابری» لازم است. در ایران سرورهای گوگل مسدودند — بدون VPN خطای network-request-failed می‌دهد. برای ورود روزمره از تب «کلید مدیر» استفاده کنید.</span>
              </div>
            </div>
          )}

          {/* Return link */}
          <div className="text-center pt-2">
            <button
              onClick={onNavigateToWalkthrough}
              className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto transition-colors"
            >
              <span>Return to Live Walkthrough Tour</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: AUTHENTICATED ADMIN DASHBOARD
  // ==========================================
  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#161928] border border-[#c5a880] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Admin Bar & User Banner */}
      <div className="vbt-glass p-4 sm:p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className="relative">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
              alt={currentUser?.displayName}
              className="w-13 h-13 rounded-2xl object-cover border-2 border-[#c5a880] shadow-md"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#090a0f]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base sm:text-lg font-bold text-white">
                {currentUser?.displayName || 'System Administrator'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#c5a880]/20 text-[#c5a880] text-[10px] font-mono font-bold border border-[#c5a880]/40">
                {currentUser?.role || 'Super Admin'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span className="font-mono text-[11px] text-[#e6d5bd]">
                {currentUser?.email ? currentUser.email : `User: ${currentUser?.username}`}
              </span>
              <span>•</span>
              <span className="text-[11px] text-slate-400">
                Sign In Method: {currentUser?.authProvider === 'google' ? 'Google (Cloud Save)' : currentUser?.authProvider === 'owner-key' ? 'Owner Key (Local)' : 'Password'}
              </span>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Global sync status pill — reflects the channel that actually publishes */}
          <button
            type="button"
            onClick={() => {
              if (cloudStatus === 'local') setAdminTab('tools');
              refreshPublishedState();
            }}
            title={
              pendingPublish
                ? 'ویرایش‌های شما هنوز روی سایت منتشر نشده — دکمه «Save & Sync All» را بزنید تا همه دستگاه‌ها و بازدیدکنندگان آن را ببینند.'
                : cloudStatus === 'cloud'
                  ? 'انتشار ابری فعال است — تنظیمات در فایربیس منتشر می‌شود.'
                  : cloudStatus === 'github'
                    ? 'انتشار سراسری از طریق گیت‌هاب فعال است — هر ذخیره، تنظیمات را برای همه منتشر می‌کند.'
                    : 'هیچ کانال سراسری فعال نیست — تنظیمات فقط روی این دستگاه ذخیره می‌شود. برای فعال‌سازی، تب ابزارها را باز کنید و توکن گیت‌هاب را وارد کنید.'
            }
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-colors ${
              pendingPublish
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                : cloudStatus === 'cloud'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : cloudStatus === 'github'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : cloudStatus === 'local'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                      : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              pendingPublish ? 'bg-amber-400 animate-ping'
                : cloudStatus === 'cloud' ? 'bg-emerald-400 animate-pulse'
                : cloudStatus === 'github' ? 'bg-cyan-400 animate-pulse'
                : cloudStatus === 'local' ? 'bg-amber-400'
                : 'bg-slate-400 animate-pulse'
            }`} />
            <span className="font-mono text-[11px]">
              {pendingPublish ? 'Publish Pending'
                : cloudStatus === 'cloud' ? 'Cloud: Online'
                : cloudStatus === 'github' ? 'Sync: GitHub'
                : cloudStatus === 'local' ? 'Sync: Local Only'
                : 'Sync: …'}
            </span>
          </button>

          {/* Explicit Save & Sync Button */}
          <button
            onClick={handleSaveAll}
            disabled={isSavingAll}
            title="Save all changes to LocalStorage, IndexedDB & Backend"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#b3956d] text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#c5a880]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Save className={`w-3.5 h-3.5 ${isSavingAll ? 'animate-spin' : ''}`} />
            <span>{isSavingAll ? 'Saving...' : 'Save & Sync All'}</span>
          </button>

          {/* Permanent GitHub & Cross-Device Sync */}
          <button
            type="button"
            onClick={() => {
              setHostingGuideTab('devices');
              setShowVideoHostingModal(true);
            }}
            title="Make tour permanent across all devices via GitHub"
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#c5a880] border border-[#c5a880]/40 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Cloud className="w-3.5 h-3.5 text-[#c5a880]" />
            <span>GitHub & Devices Sync</span>
          </button>

          {/* Quick Download tour-data.json for Git */}
          <button
            type="button"
            onClick={handleExportPublicTourData}
            title="Download tour-data.json file to put in public/ folder on GitHub (ensures incognito & guests always see your custom links)"
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-400 border border-emerald-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download tour-data.json</span>
          </button>

          <button
            onClick={() => setAdminTab('security')}
            className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all ${
              adminTab === 'security'
                ? 'bg-[#c5a880] text-black font-bold shadow'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-[#c5a880]" />
            <span>Security & Credentials</span>
          </button>

          <button
            onClick={onNavigateToWalkthrough}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/20"
          >
            <Compass className="w-3.5 h-3.5 text-[#c5a880]" />
            <span>View Live Tour</span>
          </button>

          <button
            onClick={handleExportJSON}
            title="Download JSON Backup"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/10"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all border border-rose-500/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-[#12141f] rounded-2xl border border-white/10 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setAdminTab('profiles')}
          className={`px-4 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
            adminTab === 'profiles'
              ? 'bg-[#c5a880] text-black font-bold shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Property Profiles & Agent</span>
        </button>

        <button
          onClick={() => setAdminTab('facade')}
          className={`px-4 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
            adminTab === 'facade'
              ? 'bg-[#c5a880] text-black font-bold shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Exterior Facade & Overview</span>
        </button>

        <button
          onClick={() => setAdminTab('videos')}
          className={`px-4 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
            adminTab === 'videos'
              ? 'bg-[#c5a880] text-black font-bold shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Chambers & 360 Video Scrubbing</span>
        </button>

        <button
          onClick={() => setAdminTab('motion')}
          className={`px-4 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
            adminTab === 'motion'
              ? 'bg-[#c5a880] text-black font-bold shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Motion Dynamics & Theme</span>
        </button>

        <button
          onClick={() => setAdminTab('tools')}
          className={`px-4 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
            adminTab === 'tools'
              ? 'bg-[#c5a880] text-black font-bold shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Sync, Tools & Storage</span>
        </button>

        <button
          onClick={() => setAdminTab('security')}
          className={`px-4 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
            adminTab === 'security'
              ? 'bg-[#c5a880] text-black font-bold shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security & Credentials</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 0: PROPERTY PROFILES, AGENT & TEXTS (Property Profiles, Broker & Copy) */}
      {/* ======================================================== */}
      {adminTab === 'profiles' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl vbt-glass border border-white/10 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#c5a880]" />
                <h3 className="text-base font-bold text-white">
                  Property Profiles, Broker & Marketing Copy
                </h3>
              </div>
              <p className="text-xs text-slate-300">
Manage properties, configure broker profiles, and customize marketing copy across tours.     ‌.
              </p>
            </div>

            <button
              onClick={() => setShowAddProfileModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#b3956d] text-black font-bold text-xs flex items-center gap-2 shadow-lg hover:scale-105 transition-transform shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Property</span>
            </button>
          </div>

          {/* Properties Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#c5a880]" />
                <span>Registered Property Listings ({properties.length} Properties):</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Click on any listing below to activate and configure its virtual tour.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((prop) => {
                const isActive = prop.id === currentProperty.id;
                return (
                  <div
                    key={prop.id}
                    className={`relative rounded-2xl overflow-hidden border transition-all flex flex-col justify-between ${
                      isActive
                        ? 'border-[#c5a880] bg-[#17192a] ring-1 ring-[#c5a880]/50 shadow-xl'
                        : 'border-white/10 bg-[#10121d] hover:border-white/20'
                    }`}
                  >
                    {/* Top Thumbnail */}
                    <div className="relative h-40 w-full overflow-hidden bg-black/40">
                      <img
                        src={prop.heroImage}
                        alt={prop.title}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                      
                      {/* Price Badge */}
                      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur text-[#c5a880] font-mono text-xs font-bold border border-[#c5a880]/30">
                        {prop.price}
                      </div>

                      {/* Active Status Badge */}
                      {isActive && (
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white text-[10px] font-bold flex items-center gap-1 shadow">
                          <Check className="w-3 h-3" />
                          <span>Active in Tour</span>
                        </div>
                      )}

                      {/* Specs Badge */}
                      <div className="absolute bottom-2 right-2.5 text-[11px] text-slate-200 flex items-center gap-2">
                        <span>{prop.beds} Beds</span>
                        <span>•</span>
                        <span>{prop.baths} Baths</span>
                        <span>•</span>
                        <span>{prop.sqft.toLocaleString()} Sq Ft</span>
                      </div>
                    </div>

                    {/* Content Info */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white line-clamp-1">
                          {prop.titleFa || prop.title}
                        </h4>
                        <p className="text-xs text-[#c5a880] font-mono mt-0.5 line-clamp-1">
                          {prop.title}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Compass className="w-3 h-3 text-slate-500" />
                          <span>{prop.location}</span>
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-white/10 flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            onSelectProperty(prop);
                            showToast(`Property «${prop.title}» activated for editing and tour.`);
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                            isActive
                              ? 'bg-[#c5a880] text-black font-bold'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{isActive ? 'Active Tour' : 'Select Property'}</span>
                        </button>

                        <button
                          onClick={() => handleDuplicateProperty(prop)}
                          title="Duplicate this property profile"
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors border border-white/10"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {properties.length > 1 && (
                          <button
                            onClick={() => handleDeletePropertyConfirm(prop.id, prop.titleFa || prop.title)}
                            title="Delete this property profile"
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Customizer for Active Property */}
          <div className="p-6 rounded-3xl vbt-glass border border-white/10 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#c5a880]" />
                <h4 className="text-sm font-bold text-white">
                  Edit Active Property Specifications: «{currentProperty.titleFa || currentProperty.title}»
                </h4>
              </div>
              <span className="text-xs font-mono text-[#c5a880]">ID: {currentProperty.id}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Titles & Texts Column */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Subtitle / Persian Display Title:</label>
                  <input
                    type="text"
                    value={currentProperty.titleFa || ''}
                    onChange={(e) => handleUpdatePropertyField('titleFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Property Title (English):</label>
                  <input
                    type="text"
                    value={currentProperty.title}
                    onChange={(e) => handleUpdatePropertyField('title', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Display Price:</label>
                    <input
                      type="text"
                      value={currentProperty.price}
                      onChange={(e) => handleUpdatePropertyField('price', e.target.value)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Location & Address:</label>
                    <input
                      type="text"
                      value={currentProperty.location}
                      onChange={(e) => handleUpdatePropertyField('location', e.target.value)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Bedrooms:</label>
                    <input
                      type="number"
                      value={currentProperty.beds}
                      onChange={(e) => handleUpdatePropertyField('beds', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Bathrooms:</label>
                    <input
                      type="number"
                      value={currentProperty.baths}
                      onChange={(e) => handleUpdatePropertyField('baths', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Area (Sq Ft):</label>
                    <input
                      type="number"
                      value={currentProperty.sqft}
                      onChange={(e) => handleUpdatePropertyField('sqft', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Descriptive Tagline / Subtitle:</label>
                  <input
                    type="text"
                    value={currentProperty.subtitleFa || currentProperty.subtitle}
                    onChange={(e) => handleUpdatePropertyField('subtitleFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>
              </div>

              {/* Cover Image & Hero Preview Column */}
              <div className="space-y-4">
                <label className="text-xs text-slate-300 block">Hero Cover Image URL:</label>
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 h-44">
                  <img
                    src={currentProperty.heroImage}
                    alt="Property Hero"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setMediaTargetField({ type: 'propertyHero' });
                        setShowMediaModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#c5a880] text-black font-bold text-xs flex items-center gap-1.5 shadow"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Change from Media Library</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Direct Image URL:</label>
                  <input
                    type="text"
                    value={currentProperty.heroImage}
                    onChange={(e) => handleUpdatePropertyField('heroImage', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>
              </div>

            </div>

            {/* SECTION: BROKER, AGENT & PERSONNEL SETTINGS (Broker, Personnel & Contacts) */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#c5a880]" />
                  <h4 className="text-xs font-bold text-white">
                    Broker & Sales Personnel Profile
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">Broker Card & Personnel Settings</span>
              </div>

              <div className="p-5 rounded-2xl bg-[#141624] border border-white/10 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                
                {/* Agent Avatar Preview and Uploader */}
                <div className="md:col-span-4 flex flex-col items-center text-center space-y-3">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#c5a880] shadow-xl bg-black">
                    <img
                      src={currentProperty.broker?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
                      alt={currentProperty.broker?.name || 'Broker'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMediaTargetField({ type: 'brokerAvatar' });
                      setShowMediaModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#c5a880]" />
                    <span>Change Agent Photo</span>
                  </button>
                  <span className="text-[10px] text-slate-400">High-resolution agent portrait photo</span>
                </div>

                {/* Agent Text Fields */}
                <div className="md:col-span-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Broker Full Name:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.name || ''}
                        placeholder="Javad Kazemi"
                        onChange={(e) => handleUpdateBrokerField('name', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Official Title:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.title || ''}
                        placeholder="Senior Vice President of Luxury Estates"
                        onChange={(e) => handleUpdateBrokerField('title', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Agency / Brokerage Firm:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.agency || ''}
                        placeholder="VibeTour Sotheby’s"
                        onChange={(e) => handleUpdateBrokerField('agency', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Direct Phone Number:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.phone || ''}
                        placeholder="+98 912 000 0000"
                        onChange={(e) => handleUpdateBrokerField('phone', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Broker Email:</label>
                      <input
                        type="email"
                        value={currentProperty.broker?.email || ''}
                        placeholder="kazeme.javad@gmail.com"
                        onChange={(e) => handleUpdateBrokerField('email', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] text-slate-400">Avatar Direct Photo URL:</label>
                    <input
                      type="text"
                      value={currentProperty.broker?.avatar || ''}
                      onChange={(e) => handleUpdateBrokerField('avatar', e.target.value)}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Modal for Adding New Property Profile */}
          {showAddProfileModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-xl p-6 rounded-3xl bg-[#141624] border border-[#c5a880]/40 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#c5a880]" />
                    <h3 className="text-sm font-bold text-white">Create New Property Profile</h3>
                  </div>
                  <button
                    onClick={() => setShowAddProfileModal(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateProperty} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Display Subtitle / Persian Title:</label>
                      <input
                        type="text"
                        required
                        value={newPropTitleFa}
                        placeholder="The Bel-Air Promontory Estate"
                        onChange={(e) => setNewPropTitleFa(e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Property Title (English):</label>
                      <input
                        type="text"
                        required
                        value={newPropTitle}
                        placeholder="The Elahieh Kinetic Estate"
                        onChange={(e) => setNewPropTitle(e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Listing Price:</label>
                      <input
                        type="text"
                        value={newPropPrice}
                        placeholder="$35,000,000"
                        onChange={(e) => setNewPropPrice(e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Location & City:</label>
                      <input
                        type="text"
                        value={newPropLocation}
                        placeholder="Beverly Hills, California"
                        onChange={(e) => setNewPropLocation(e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Bedrooms:</label>
                      <input
                        type="number"
                        value={newPropBeds}
                        onChange={(e) => setNewPropBeds(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Bathrooms:</label>
                      <input
                        type="number"
                        value={newPropBaths}
                        onChange={(e) => setNewPropBaths(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Area (Sq Ft):</label>
                      <input
                        type="number"
                        value={newPropSqft}
                        onChange={(e) => setNewPropSqft(parseInt(e.target.value) || 1000)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Hero Facade Cover Image URL:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPropHero}
                        onChange={(e) => setNewPropHero(e.target.value)}
                        className="flex-1 bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMediaTargetField({ type: 'newProfileHero' });
                          setShowMediaModal(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs shrink-0"
                      >
                        Media Library
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddProfileModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#c5a880] text-black font-bold text-xs shadow-lg hover:scale-105 transition-transform"
                    >
                      Create & Activate Listing
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: FACADE & ARCHITECTURAL STYLING SETTINGS (Exterior Facade Settings) */}
      {/* ======================================================== */}
      {adminTab === 'facade' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          
          {/* Left Column: Visual Facade Preview & Media Links (5 Cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="vbt-glass p-5 rounded-2xl border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#c5a880]" />
                  <h3 className="text-sm font-bold text-white">Exterior Facade Cover & Media</h3>
                </div>
                <span className="text-[10px] text-[#c5a880] font-mono">Exterior Facade</span>
              </div>

              {/* Live Facade Image Preview */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-white/15 group">
                <img
                  src={currentProperty.heroImage}
                  alt={currentProperty.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 text-right">
                  <span className="text-[9px] font-mono text-[#c5a880] uppercase tracking-wider block">
                    Primary Facade Cover • 4K
                  </span>
                  <p className="text-xs font-bold text-white truncate">{currentProperty.titleFa || currentProperty.title}</p>
                </div>
              </div>

              {/* Image URL Input & Library Button */}
              <div className="space-y-2">
                <label className="text-xs text-slate-300 block">Direct Hero Image URL:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentProperty.heroImage}
                    onChange={(e) => handleUpdatePropertyField('heroImage', e.target.value)}
                    className="flex-1 bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTargetField({ type: 'propertyHero' });
                      setShowMediaModal(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#c5a880]/20 hover:bg-[#c5a880]/30 text-[#c5a880] border border-[#c5a880]/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Media Library</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Facade Images */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="text-[10px] text-slate-400 block">Luxury Facade Presets:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Curvilinear Glass Penthouse',
                      url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      label: 'Mediterranean Oceanfront Villa',
                      url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      label: 'Neo-Classical Palace Estate',
                      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
                    },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleUpdatePropertyField('heroImage', preset.url)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[10px] text-slate-300 text-center transition-colors truncate border border-white/5"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Facade Materials Card */}
            <div className="vbt-glass p-5 rounded-2xl border border-white/10 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Sparkles className="w-4 h-4 text-[#c5a880]" />
                <h4 className="text-xs font-bold text-white">Exterior Materials & Cladding</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#141624] border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium block">Navona Roman Travertine Stone</span>
                    <span className="text-[10px] text-slate-400">Origin: Tivoli, Italy • Honed Cross-Cut</span>
                  </div>
                  <span className="text-[10px] text-[#c5a880] font-mono font-bold">A++ Luxury</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#141624] border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium block">Saint-Gobain Curved Triple-Glazed Low-E</span>
                    <span className="text-[10px] text-slate-400">Saint-Gobain France with Acoustic & UV Shielding</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Eco Thermal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Architectural Data Fields (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="vbt-glass p-6 rounded-2xl border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#c5a880]" />
                  <h3 className="text-sm font-bold text-white">Property Architectural & Identity Specs</h3>
                </div>
                <span className="text-[10px] text-slate-400">Auto-saved to Storage</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Property Title (English):</label>
                  <input
                    type="text"
                    value={currentProperty.title}
                    onChange={(e) => handleUpdatePropertyField('title', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Display Subtitle / Tagline:</label>
                  <input
                    type="text"
                    value={currentProperty.titleFa || ''}
                    placeholder="The Sky Villa at Port Hercule"
                    onChange={(e) => handleUpdatePropertyField('titleFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Display Price:</label>
                  <input
                    type="text"
                    value={currentProperty.price}
                    onChange={(e) => handleUpdatePropertyField('price', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Location & Address:</label>
                  <input
                    type="text"
                    value={currentProperty.location}
                    onChange={(e) => handleUpdatePropertyField('location', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Interior Area (Sq Ft):</label>
                  <input
                    type="number"
                    value={currentProperty.sqft}
                    onChange={(e) => handleUpdatePropertyField('sqft', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Architect / Design Studio:</label>
                  <input
                    type="text"
                    value={currentProperty.architect}
                    onChange={(e) => handleUpdatePropertyField('architect', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Bedrooms (Suites):</label>
                  <input
                    type="number"
                    value={currentProperty.beds}
                    onChange={(e) => handleUpdatePropertyField('beds', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Bathrooms:</label>
                  <input
                    type="number"
                    value={currentProperty.baths}
                    onChange={(e) => handleUpdatePropertyField('baths', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <label className="text-xs text-slate-300">Tagline & Architectural Style:</label>
                <input
                  type="text"
                  value={currentProperty.tagline}
                  onChange={(e) => handleUpdatePropertyField('tagline', e.target.value)}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">Descriptive Subtitle:</label>
                <textarea
                  rows={2}
                  value={currentProperty.subtitleFa || currentProperty.subtitle}
                  onChange={(e) => handleUpdatePropertyField('subtitleFa', e.target.value)}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] resize-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">All updates render directly in the interactive tour.</span>
                <button
                  type="button"
                  onClick={onNavigateToWalkthrough}
                  className="px-4 py-2 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Preview in Walkthrough</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: VIDEOS & CHAMBERS MANAGEMENT (Chambers & Videos) */}
      {/* ======================================================== */}
      {adminTab === 'videos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          
          {/* Chamber Selector List (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="vbt-glass p-5 rounded-2xl border border-white/10 space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#c5a880]" />
                  <h3 className="text-xs font-bold text-white">Chambers & Walkthrough Sequence</h3>
                </div>
                <span className="text-[10px] font-mono text-[#c5a880] font-bold">
                  {currentProperty.rooms.length} Chambers
                </span>
              </div>

              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {currentProperty.rooms.map((room, idx) => (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedRoom.id === room.id
                        ? 'bg-[#1e2235] border-[#c5a880] shadow-md'
                        : 'bg-[#141624] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                        <img
                          src={room.thumbnailUrl}
                          alt={room.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-white truncate">
                          {room.nameFa || room.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {room.enablePauseGate ? 'Auto Checkpoint Active' : 'Continuous Scrub'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-[#c5a880] font-bold shrink-0">
                      0{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Video & Checkpoint Details for Selected Room (8 Cols) */}
          <div className="lg:col-span-8 space-y-5">
            <div className="vbt-glass p-6 rounded-2xl border border-white/10 space-y-5 shadow-xl">
              
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono text-[#c5a880] uppercase tracking-wider block">
                    Chamber & Video Scrubbing Configuration
                  </span>
                  <h3 className="font-display text-base sm:text-lg font-bold text-white mt-0.5">
                    {selectedRoom.nameFa || selectedRoom.name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Media Pipeline:</span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">
                    {selectedRoom.mediaType.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Video Player Live Preview */}
              {(() => {
                const analysis = analyzeAndConvertVideoUrl(selectedRoom.videoUrl || selectedRoom.mediaUrl);
                // Fallback chain: the preview tries each candidate in order and moves to
                // the next one when a source fails (403 / HTML interstitial / CORS).
                const previewCandidates = analysis.candidates.length > 0 ? analysis.candidates : [analysis.streamUrl].filter(Boolean);
                const activePreviewUrl = previewCandidates[0] || selectedRoom.mediaUrl;
                return (
                  <div className="space-y-2">
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black shadow-lg">
                      {analysis.platform === 'youtube' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center p-6">
                          <AlertTriangle className="w-8 h-8 text-amber-400" />
                          <span className="text-xs font-bold text-amber-300" dir="rtl">لینک یوتیوب در موتور اسکرول پشتیبانی نمی‌شود</span>
                          <span className="text-[11px] text-slate-400" dir="rtl">{analysis.warning}</span>
                        </div>
                      ) : (
                        <video
                          key={activePreviewUrl}
                          src={activePreviewUrl}
                          controls
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Stream Protocol Indicator */}
                    <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${analysis.platform === 'gdrive' ? 'bg-amber-400' : analysis.platform === 'github' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                        <span>Stream Source: <strong className="text-white capitalize">{analysis.platform === 'gdrive' ? 'Google Drive' : analysis.platform === 'github' ? 'GitHub Cloud' : analysis.platform}</strong></span>
                      </span>
                      {analysis.isConverted && (
                        <span className="text-amber-400 font-mono text-[10px] bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          Auto-Converted to Direct Stream
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Video URL Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 block">
                    Video Walkthrough Stream URL (MP4 / WebM / Sequence):
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowVideoHostingModal(true)}
                    className="text-[11px] text-[#c5a880] hover:text-[#e6d5bd] flex items-center gap-1 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>How to get direct video link (GitHub / Drive)</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedRoom.videoUrl || selectedRoom.mediaUrl}
                    onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'videoUrl', e.target.value)}
                    placeholder="https://... or /videos/room-1.mp4"
                    className="flex-1 bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTargetField({ type: 'roomVideo', roomId: selectedRoom.id });
                      setShowMediaModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black text-xs font-bold flex items-center gap-1.5 transition-colors shadow shrink-0"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Select Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVideoHostingModal(true)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#c5a880] text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/15 shrink-0"
                    title="Video Hosting Guide & Link Converter"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Hosting Guide</span>
                  </button>
                </div>

                {/* Inline Google Drive & GitHub Link Conversion Assistant */}
                {(() => {
                  const analysis = analyzeAndConvertVideoUrl(selectedRoom.videoUrl || '');
                  if (analysis.platform === 'gdrive') {
                    return (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Google Drive Video Detected</span>
                          </div>
                          <span className="text-[10px] font-mono text-amber-400/80">File ID: {analysis.fileId}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Standard Google Drive share links load an HTML webpage, preventing kinetic scroll scrubbing. VibeTour Pro automatically converts this into a direct stream URL. Ensure your Drive file permissions are set to <strong>"Anyone with the link can view"</strong>.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {analysis.directOptions?.filter((opt) => !isStaticHost() || !opt.url.startsWith('/api/')).map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                handleUpdateRoomField(selectedRoom.id, 'videoUrl', opt.url);
                                showToast(`Applied: ${opt.label}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-[10px] font-mono border border-amber-400/30 transition-colors"
                            >
                              Apply: {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (analysis.platform === 'github' && analysis.isConverted) {
                    return (
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>GitHub Web Link Converted to Direct Stream</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          GitHub web page link was converted to direct raw stream URL.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateRoomField(selectedRoom.id, 'videoUrl', analysis.streamUrl);
                            showToast('Applied direct raw stream URL');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 text-[10px] font-mono border border-emerald-400/30"
                        >
                          Use Direct Stream: {analysis.streamUrl}
                        </button>
                      </div>
                    );
                  }
                  if (analysis.platform === 'local') {
                    return (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-xs text-rose-300 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Temporary Local File Detected (فایل موقت لوکال ویندوز)</span>
                          </div>
                          <span className="text-[10px] font-mono text-rose-400/80">blob:...</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          این ویدیو از حافظه موقت سیستم شما فراخوانی شده و <strong>در سایر دیوایس‌ها (موبایل، تبلت یا لپ‌تاپ دیگران) نمایش داده نخواهد شد</strong>. برای کارکرد روی تمام دستگاه‌ها، ویدیو را در پوشه <code className="text-[#c5a880]">public/videos/</code> پروژه قرار دهید (مانند <code className="text-[#c5a880]">/videos/room-1.mp4</code>) یا در GitHub Releases آپلود کنید.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setHostingGuideTab('github');
                              setShowVideoHostingModal(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-semibold border border-rose-500/30 transition-colors"
                          >
                            مشاهده راهنمای گیت‌هاب و ذخیره دائمی
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (analysis.platform === 'youtube') {
                    return (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>YouTube Link — Not Suitable for Scroll Scrubbing</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed" dir="rtl">
                          یوتیوب امکان اسکرول فریم‌به‌فریم داخل تگ video را نمی‌دهد. فایل MP4 را دانلود کنید و روی گیت‌هاب (مخزن یا Releases) میزبانی کنید تا بدون لگ اسکرول شود.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Checkpoint Decision Gate Config (Auto Checkpoint Pause Gate) */}
              <div className="p-4 rounded-2xl bg-[#141624] border border-[#c5a880]/40 space-y-3 shadow-lg">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-[#c5a880]" />
                    <span className="text-xs font-bold text-white">
                      Auto Checkpoint Pause Gate & Chamber Portal
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoom.enablePauseGate ?? false}
                      onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'enablePauseGate', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c5a880]"></div>
                  </label>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
When user scrolls, motion pauses at designated checkpoint and prompts room navigation.    Chambers  ‌     .
                </p>

                {selectedRoom.enablePauseGate && (
                  <div className="space-y-3 pt-2 border-t border-white/10 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">Checkpoint trigger progress:</span>
                      <span className="font-mono text-[#c5a880] font-bold">
                        {Math.round((selectedRoom.pauseCheckpointProgress ?? 0.85) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.95"
                      step="0.05"
                      value={selectedRoom.pauseCheckpointProgress ?? 0.85}
                      onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'pauseCheckpointProgress', parseFloat(e.target.value))}
                      className="w-full accent-[#c5a880] cursor-pointer h-1.5"
                    />

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Checkpoint prompt title:</label>
                      <input
                        type="text"
                        value={selectedRoom.pauseGateTitleFa || ''}
                        placeholder="Reached entrance portal: Choose next chamber to explore:"
                        onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'pauseGateTitleFa', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Room details fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Chamber Title:</label>
                  <input
                    type="text"
                    value={selectedRoom.nameFa || ''}
                    placeholder="Grand Living Salon"
                    onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'nameFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Short Subtitle / Description:</label>
                  <input
                    type="text"
                    value={selectedRoom.subtitleFa || selectedRoom.subtitle}
                    onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'subtitleFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: MOTION, KINETIC & SCROLL ENGINE (Kinetic Motion & Velocity) */}
      {/* ======================================================== */}
      {adminTab === 'motion' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
          <div className="vbt-glass p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Gauge className="w-5 h-5 text-[#c5a880]" />
                <div>
                  <h3 className="text-base font-bold text-white">Cinematic Scroll Velocity & Inertia Physics</h3>
                  <p className="text-xs text-slate-400">Control trackpad sensitivity, touch dragging, and GSAP inertia scrubbing.</p>
                </div>
              </div>
              <span className="font-mono text-sm text-[#c5a880] font-bold">
                {((config.scrollSpeedFactor || 0.1) * 100).toFixed(0)}% Speed
              </span>
            </div>

            {/* Scroll Speed Factor with Presets */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-white block">
                Speed Multiplier Presets:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: '0.25x Slow', val: 0.25, desc: 'Cinematic Slow' },
                  { label: '0.50x Cinematic', val: 0.5, desc: 'Tuned Default' },
                  { label: '1.00x Standard', val: 1.0, desc: 'Balanced' },
                  { label: '2.00x Fast', val: 2.0, desc: 'Responsive' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => {
                      onUpdateConfig({ ...config, scrollSpeedFactor: item.val });
                      showToast(`Scroll speed set to ${item.val}x applied.`);
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all ${
                      Math.abs((config.scrollSpeedFactor || 0.1) - item.val) < 0.05
                        ? 'bg-[#c5a880] text-black font-bold border-[#c5a880] shadow-lg'
                        : 'bg-[#141624] text-slate-300 border-white/10 hover:border-[#c5a880]/50'
                    }`}
                  >
                    <span className="text-xs block font-bold">{item.label}</span>
                    <span className="text-[10px] opacity-75 font-mono mt-0.5 block">{item.desc}</span>
                  </button>
                ))}
              </div>

              {/* Range Slider for Fine Tuning */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Fine Tune Speed Factor:</span>
                  <span className="font-mono text-[#c5a880] font-bold">
                    {(config.scrollSpeedFactor || 0.1).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="2.0"
                  step="0.05"
                  value={config.scrollSpeedFactor || 0.1}
                  onChange={(e) => onUpdateConfig({ ...config, scrollSpeedFactor: parseFloat(e.target.value) })}
                  className="w-full accent-[#c5a880] cursor-pointer h-2"
                />
              </div>
            </div>

            {/* Checkpoint Gates Global Toggle */}
            <div className="p-4 rounded-2xl bg-[#141624] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Enable Global Checkpoint Pause Gates Across All Chambers
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  When reaching designated checkpoint progress, scroll is paused until destination is chosen.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enableGlobalCheckpointGates !== false}
                  onChange={(e) => onUpdateConfig({ ...config, enableGlobalCheckpointGates: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c5a880]"></div>
              </label>
            </div>

            {/* GSAP Scrub Smoothing */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">GSAP Scrub Smoothing Inertia:</span>
                <span className="font-mono text-[#c5a880] font-bold">{config.scrubSmoothing}s</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={config.scrubSmoothing}
                onChange={(e) => onUpdateConfig({ ...config, scrubSmoothing: parseFloat(e.target.value) })}
                className="w-full accent-[#c5a880] cursor-pointer h-1.5"
              />
            </div>

            {/* Sound Effects */}
            <div className="p-4 rounded-2xl bg-[#141624] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Haptic Sound Effects & Spatial Soundscapes</span>
<span className="text-[11px] text-slate-400 block mt-0.5">Play subtle luxury haptic audio cues when crossing checkpoints‌     ‌</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enableSoundScape}
                  onChange={(e) => onUpdateConfig({ ...config, enableSoundScape: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c5a880]"></div>
              </label>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ADVANCED TOOLS & ELEMENTOR BUILDER (Advanced Tools & Elementor) */}
      {/* ======================================================== */}
      {adminTab === 'tools' && (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
          
          <div className="p-5 rounded-3xl vbt-glass border border-white/10 shadow-xl space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#c5a880]" />
              <h3 className="text-base font-bold text-white">
                Advanced Tools, Live Elementor Studio & WordPress Plugins
              </h3>
            </div>
            <p className="text-xs text-slate-300">
Direct access to visual builder, video test bench, plugin generator, and broker conversion models. ‌     .
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Tool 1: Elementor Studio Builder */}
            <div className="p-6 rounded-3xl vbt-glass border border-white/10 space-y-4 shadow-xl flex flex-col justify-between hover:border-[#c5a880]/50 transition-all">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#c5a880]/15 border border-[#c5a880]/30 flex items-center justify-center text-[#c5a880]">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Live Elementor Visual Studio</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
Live real-time customizer for fonts, champagne gold accents, button radiuses, and HUD styling.   .
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('elementor_builder')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#b3956d] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
              >
                <span>Open Elementor Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tool 2: Video Optimizer */}
            <div className="p-6 rounded-3xl vbt-glass border border-white/10 space-y-4 shadow-xl flex flex-col justify-between hover:border-[#c5a880]/50 transition-all">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Film className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">4K Video Stream Resilience & Optimizer</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
Inspect video codec compatibility, test frame buffering, and ensure smooth 60 FPS playback.      .
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('video_optimizer')}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
              >
                <span>Open Video Optimizer</span>
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>

            {/* Tool 3: Plugin Code & ZIP Generator */}
            <div className="p-6 rounded-3xl vbt-glass border border-white/10 space-y-4 shadow-xl flex flex-col justify-between hover:border-[#c5a880]/50 transition-all">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">WordPress Plugin Package & ZIP Export</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Generate complete production-grade WordPress plugin package with shortcodes and Elementor widget.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('plugin_code')}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
              >
                <span>Export WordPress Plugin (.zip)</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>

            {/* Tool 4: Broker ROI Blueprint */}
            <div className="p-6 rounded-3xl vbt-glass border border-white/10 space-y-4 shadow-xl flex flex-col justify-between hover:border-[#c5a880]/50 transition-all">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Broker ROI & Conversion Blueprint</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    In-depth ROI analytics demonstrating 300% longer visitor retention and ultra-high conversion rates.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('broker_roi')}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
              >
                <span>View Broker ROI Blueprint</span>
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>

          </div>

          {/* Tool 5: GitHub Publish — global settings + account credential */}
          <div className="p-6 rounded-3xl vbt-glass border border-[#c5a880]/30 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#c5a880]" />
              <h4 className="text-sm font-bold text-white">انتشار جهانی روی گیت‌هاب (GitHub Publish)</h4>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed" dir="rtl">
              این کار دو فایل را در مخزن به‌روز می‌کند: <span className="font-mono">public/tour-data.json</span> (تنظیمات تور برای همه بازدیدکنندگان) و <span className="font-mono">public/admin-credential.json</span> (فقط هش رمز مدیر برای ورود روی دستگاه‌های جدید — رمز اصلی هرگز منتشر نمی‌شود).
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-300 block" dir="rtl">توکن دسترسی شخصی گیت‌هاب (PAT) با دسترسی repo — فقط در همین مرورگر ذخیره می‌شود:</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={ghPat}
                  onChange={(e) => {
                    setGhPat(e.target.value);
                    setStoredPat(e.target.value);
                    // Flip the status pill as soon as a token is present so the
                    // owner sees "Sync: GitHub" without having to save first.
                    if (isOwnerGoogleUser()) setCloudStatus('cloud');
                    else if (e.target.value.trim()) setCloudStatus('github');
                    else setCloudStatus('local');
                  }}
                  dir="ltr"
                  placeholder="ghp_… / github_pat_…"
                  className="flex-1 bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono"
                />
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 text-center transition-colors"
                >
                  ساخت توکن ↗
                </a>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed" dir="rtl">
                پس از وارد کردن توکن یک‌بار، هر بار که «Save &amp; Sync All» را بزنید انتشار سراسری به‌صورت خودکار انجام می‌شود — دیگر نیازی به زدن دکمه جداگانه نیست.
              </p>
            </div>

            {/* Live publication diagnostics — what the deployed site actually serves */}
            <div className="p-4 rounded-2xl bg-[#141624] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white" dir="rtl">وضعیت انتشار روی سایت لایو</span>
                <button
                  type="button"
                  onClick={refreshPublishedState}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] text-white font-semibold transition-colors"
                >
                  بررسی مجدد
                </button>
              </div>
              <div className="space-y-1 text-[11px] font-mono" dir="ltr">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">tour-data.json</span>
                  <span className={published?.tourData.exists ? 'text-emerald-400' : 'text-amber-400'}>
                    {published ? (published.tourData.exists ? `published · ${published.tourData.propertyCount} properties` : 'not published') : 'checking…'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">admin-credential.json</span>
                  <span className={published?.credential.exists ? 'text-emerald-400' : 'text-amber-400'}>
                    {published ? (published.credential.exists ? `published · ${published.credential.email}` : 'not published') : 'checking…'}
                  </span>
                </div>
                {published?.tourData.updatedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">last update</span>
                    <span className="text-slate-300">{published.tourData.updatedAt}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={isPublishing || !ghPat.trim()}
              onClick={async () => {
                await handleGitHubPublish();
                refreshPublishedState();
                refreshSyncStatus();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-md shadow-[#c5a880]/20"
            >
              <Cloud className="w-4 h-4" />
              <span dir="rtl">{isPublishing ? 'در حال انتشار…' : 'انتشار فوری تنظیمات + حساب مدیر'}</span>
            </button>
            <p className="text-[10px] text-slate-500 leading-relaxed" dir="rtl">
              پس از انتشار، Actions سایت را می‌سازد (۱ تا ۲ دقیقه). سپس همه دستگاه‌ها و بازدیدکنندگان همان تنظیمات را می‌بینند و ورود مدیر روی هر دستگاه جدید با همان رمز ممکن می‌شود.
            </p>

            {/* Tokenless fallback: copy or download the exact files to commit manually */}
            <div className="pt-1 border-t border-white/10 space-y-2">
              <span className="text-[11px] text-slate-300 block" dir="rtl">یا بدون توکن: محتوای فایل‌ها را کپی یا دانلود کنید تا در پوشه <span className="font-mono">public/</span> مخزن کامیت شود.</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['tour-data.json', 'admin-credential.json'] as const).map((file) => {
                  const buildContent = (): string | null => {
                    if (file === 'tour-data.json') {
                      return JSON.stringify({
                        properties,
                        config,
                        selectedPropertyId: currentProperty.id,
                        activeRoomId: selectedRoomId,
                        updatedAt: new Date().toISOString()
                      }, null, 2);
                    }
                    const cred = authService.getOwnerCredential();
                    if (!cred) return null;
                    return JSON.stringify({
                      email: cred.email,
                      salt: cred.salt,
                      passwordHash: cred.passwordHash,
                      recoveryHash: cred.recoveryHash,
                      createdAt: cred.createdAt,
                      hashVersion: cred.hashVersion,
                      updatedAt: new Date().toISOString()
                    }, null, 2);
                  };
                  const download = (content: string) => {
                    const blob = new Blob([content], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  };
                  return (
                    <div key={file} className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-black/25 border border-white/10">
                      <span className="font-mono text-[10px] text-[#c5a880]">{file}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            const content = buildContent();
                            if (!content) {
                              showToast('ابتدا حساب مدیر را روی این دستگاه بسازید.');
                              return;
                            }
                            try {
                              await navigator.clipboard.writeText(content);
                              showToast(`${file} کپی شد — محتوا را در public/ کامیت کنید.`);
                            } catch {
                              showToast('کپی ناموفق بود — از دکمه دانلود استفاده کنید.');
                            }
                          }}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-colors"
                        >
                          کپی JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const content = buildContent();
                            if (!content) {
                              showToast('ابتدا حساب مدیر را روی این دستگاه بسازید.');
                              return;
                            }
                            download(content);
                            showToast(`${file} دانلود شد.`);
                            refreshPublishedState();
                          }}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-colors"
                        >
                          دانلود
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: SECURITY, USERNAME & PASSWORD MANAGEMENT (Security & Credentials) */}
      {/* ======================================================== */}
      {adminTab === 'security' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
          
          {/* Main Credentials Change Card */}
          <div className="vbt-glass p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-[#c5a880]" />
                <div>
                  <h3 className="text-base font-bold text-white">Administrator Identity & Security</h3>
                  <p className="text-xs text-slate-400">A single admin identity — the owner's verified Google account.</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                Security Protection Active
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-[#141624] border border-[#c5a880]/25 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#c5a880]" />
                  <span className="text-xs font-bold text-white" dir="rtl">حساب مدیر (Owner Account)</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${hasOwnerAccount ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                  {hasOwnerAccount ? 'Registered on this device' : 'Not registered'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed" dir="rtl">
                ثبت‌نام و ورود مدیر کاملاً محلی است (PBKDF2 هش‌شده روی همین دستگاه) و به گوگل وابسته نیست — بدون VPN هم کار می‌کند. ذخیره ابری همچنان فقط با حساب گوگل مالک و طبق قوانین سروری Firestore ممکن است.
              </p>
              {hasOwnerAccount ? (
                <form onSubmit={handleChangeOwnerPassword} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">رمز فعلی:</label>
                      <input type="password" value={secCurrent} onChange={(e) => setSecCurrent(e.target.value)} required dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">رمز جدید (≥ ۸ کاراکتر):</label>
                      <input type="password" value={secNew} onChange={(e) => setSecNew(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">تکرار رمز جدید:</label>
                      <input type="password" value={secConfirm} onChange={(e) => setSecConfirm(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                  </div>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[#c5a880]/20">
                    <Key className="w-3.5 h-3.5" />
                    <span dir="rtl">تغییر رمز مدیر</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleOwnerRegister} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">ایمیل مالک:</label>
                      <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">رمز عبور (≥ ۸ کاراکتر):</label>
                      <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block" dir="rtl">تکرار رمز:</label>
                      <input type="password" value={ownerConfirm} onChange={(e) => setOwnerConfirm(e.target.value)} required minLength={8} dir="ltr" className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono" />
                    </div>
                  </div>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[#c5a880]/20">
                    <Key className="w-3.5 h-3.5" />
                    <span dir="rtl">ساخت حساب مدیر</span>
                  </button>
                  <p className="text-[10px] text-amber-300/80" dir="rtl">پس از ثبت‌نام، یک کد بازیابی نمایش داده می‌شود — آن را ذخیره کنید.</p>
                </form>
              )}
            </div>
          </div>

          {/* Connected Google & Gmail Account Status */}
          <div className="vbt-glass p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#c5a880]" />
                <h4 className="text-xs font-bold text-white">Google & Gmail Authentication Sync</h4>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">Google SSO Ready</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#141624] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Super Admin Google Account:</span>
                  <span className="text-xs font-mono text-[#c5a880]">kazeme.javad@gmail.com</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleGoogleLogin();
                }}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/20"
              >
                Re-verify Google Account
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Video Hosting & Direct Link Generator Modal (GitHub vs. Google Drive) */}
      {showVideoHostingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#12141e] border border-white/20 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#161824]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#c5a880]/20 flex items-center justify-center text-[#c5a880] border border-[#c5a880]/30">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Video Walkthrough Hosting & Link Studio
                  </h3>
                  <p className="text-xs text-slate-400">
                    Direct stream links for kinetic scrubbing with Google Drive & GitHub Pages
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoHostingModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/10 bg-[#0e1017] px-5 pt-2 gap-4">
              <button
                type="button"
                onClick={() => setHostingGuideTab('github')}
                className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                  hostingGuideTab === 'github'
                    ? 'border-[#c5a880] text-[#c5a880]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Method 1: GitHub Hosting (Zero-Lag 60FPS)</span>
              </button>
              <button
                type="button"
                onClick={() => setHostingGuideTab('gdrive')}
                className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                  hostingGuideTab === 'gdrive'
                    ? 'border-[#c5a880] text-[#c5a880]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <HardDrive className="w-4 h-4" />
                <span>Method 2: Google Drive Direct Converter</span>
              </button>
              <button
                type="button"
                onClick={() => setHostingGuideTab('devices')}
                className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                  hostingGuideTab === 'devices'
                    ? 'border-[#c5a880] text-[#c5a880]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Method 3: GitHub & All-Devices Sync (ذخیره دائمی همه دیوایس‌ها)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {hostingGuideTab === 'github' ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-slate-300 space-y-2">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      Why GitHub Hosting is 100% recommended for scroll video:
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      GitHub and GitHub Pages natively support <strong>HTTP 206 Partial Content (Byte-Range requests)</strong>. When a user scrolls, the browser instantly fetches only the exact milliseconds needed, enabling zero-latency reverse and forward scrubbing without buffering the entire video!
                    </p>
                  </div>

                  {/* Way A */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#c5a880] text-black font-bold flex items-center justify-center text-[10px]">A</span>
                        <span>Option A: Inside GitHub Repository (<code>public/videos/</code>)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Best for standard video files</span>
                    </div>

                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed pl-1">
                      <li>Place your MP4 video file inside the <code className="text-[#c5a880]">public/videos/</code> directory of your project (e.g. <code className="text-[#c5a880]">public/videos/room-1.mp4</code>).</li>
                      <li>In VibeTour Pro, set the stream URL to: <code className="text-[#c5a880] font-mono">/videos/room-1.mp4</code>.</li>
                      <li>When committed and pushed to GitHub Pages, the direct public link automatically becomes:
                        <div className="mt-1 p-2 bg-[#090a0f] rounded-lg font-mono text-[#c5a880] text-[10px] break-all border border-white/10">
                          https://[your-github-username].github.io/[repository-name]/videos/room-1.mp4
                        </div>
                      </li>
                    </ol>
                  </div>

                  {/* Way B */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#c5a880] text-black font-bold flex items-center justify-center text-[10px]">B</span>
                        <span>Option B: GitHub Releases (Up to 2GB per video, High-Speed CDN)</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">Best for 4K / High-Bitrate files</span>
                    </div>

                    <ol className="list-decimal list-inside space-y-2 text-slate-300 text-[11px] leading-relaxed pl-1">
                      <li>Go to your GitHub repository in your browser: <code className="text-[#c5a880]">https://github.com/[user]/[repo]/releases/new</code></li>
                      <li>In the "Tag version" box, type <code className="text-[#c5a880]">v1.0.0</code> and click "Create new tag".</li>
                      <li>Under "Attach binaries by dropping them here", drag and drop your <strong>.mp4</strong> video files. GitHub allows up to 2GB per file!</li>
                      <li>Click the green <strong>"Publish release"</strong> button.</li>
                      <li>On the published release page, right-click the uploaded <strong>.mp4</strong> file link and select <strong>"Copy Link Address"</strong>.</li>
                      <li>The copied direct URL will look like:
                        <div className="mt-1 p-2 bg-[#090a0f] rounded-lg font-mono text-[#c5a880] text-[10px] break-all border border-white/10">
                          https://github.com/[user]/[repo]/releases/download/v1.0.0/room-1.mp4
                        </div>
                      </li>
                      <li>Paste that link directly into the Chamber Video URL in VibeTour Pro!</li>
                    </ol>
                  </div>
                </div>
              ) : hostingGuideTab === 'gdrive' ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-300 space-y-2">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      Why normal Google Drive links don't scrub on scroll:
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      A normal share link (e.g. <code className="text-amber-200">drive.google.com/file/d/.../view?usp=sharing</code>) loads Google's HTML preview webpage with UI buttons, not raw video frames! Moreover, Google Drive limits cross-origin byte-range requests for files over 100MB.
                    </p>
                  </div>

                  {/* Converter Tool */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-3">
                    <span className="font-bold text-white text-xs block">
                      1-Click Google Drive Link Converter & Direct Stream Generator:
                    </span>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={converterInputUrl}
                        onChange={(e) => setConverterInputUrl(e.target.value)}
                        placeholder="Paste Google Drive share link here: https://drive.google.com/file/d/..."
                        className="flex-1 bg-[#090a0f] border border-white/15 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:border-[#c5a880] focus:outline-none"
                      />
                    </div>

                    {/* Results */}
                    {converterInputUrl && (() => {
                      const analysis = analyzeAndConvertVideoUrl(converterInputUrl);
                      if (analysis.platform === 'gdrive' && analysis.fileId) {
                        return (
                          <div className="p-3.5 rounded-xl bg-[#0d0f17] border border-[#c5a880]/30 space-y-3 mt-2">
                            <div className="flex items-center justify-between text-xs text-white">
                              <span className="font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                File ID extracted: <code className="text-[#c5a880] font-mono">{analysis.fileId}</code>
                              </span>
                            </div>

                            <div className="space-y-2">
                              {analysis.directOptions?.filter((opt) => !isStaticHost() || !opt.url.startsWith('/api/')).map((opt, i) => (
                                <div key={i} className="p-2.5 rounded-lg bg-[#141624] border border-white/5 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[#c5a880] text-[11px]">{opt.label}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateRoomField(selectedRoom.id, 'videoUrl', opt.url);
                                        showToast(`Applied ${opt.label} to ${selectedRoom.name}!`);
                                        setShowVideoHostingModal(false);
                                      }}
                                      className="px-2.5 py-1 rounded bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-bold text-[10px] transition-colors"
                                    >
                                      Apply to Chamber
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-slate-400">{opt.description}</p>
                                  <div className="p-1.5 bg-black/60 rounded font-mono text-[9px] text-slate-300 break-all select-all">
                                    {opt.url}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <p className="text-[11px] text-amber-300">
                          Please enter a valid Google Drive URL containing a file ID.
                        </p>
                      );
                    })()}
                  </div>

                  {/* Permissions Checklist */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-2 text-slate-300 text-[11px]">
                    <span className="font-bold text-white text-xs block">
                      Required Google Drive Permissions Checklist:
                    </span>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                      <li>In Google Drive, right-click the video file and click <strong>Share</strong>.</li>
                      <li>Under "General access", switch from "Restricted" to <strong>"Anyone with the link"</strong> (Viewer).</li>
                      <li>If your video is over 100MB, Google Drive will show a virus scan prompt on direct downloads; for large videos, hosting on <strong>GitHub Releases (Method 1)</strong> is strongly recommended for 60fps scrubbing!</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Diagnosis & Core Answer */}
                  <div className="p-4 rounded-2xl bg-[#c5a880]/10 border border-[#c5a880]/30 text-slate-300 space-y-2">
                    <span className="font-bold text-[#c5a880] flex items-center gap-1.5 text-xs">
                      <HelpCircle className="w-4 h-4" />
                      علت ریست شدن اطلاعات در دستگاه‌های مختلف و راه‌حل قطعی
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      <strong>مشکل چیست؟</strong> هنگامی که در پنل ادمین اطلاعات را ویرایش می‌کنید، داده‌ها در حافظه محلی مرورگر (LocalStorage) همان کامپیوتر ذخیره می‌شوند. همچنین اگر فایلی را از سیستم ویندوز انتخاب کرده باشید، آدرس به شکل <code className="text-amber-300 font-mono">blob:...</code> ایجاد می‌شود که فقط در همان لحظه و در همان مرورگر اعتبار دارد و در گوشی یا دستگاه دیگر باز نمی‌شود.
                    </p>
                    <p className="text-[11px] leading-relaxed text-emerald-300">
                      <strong>راه‌حل دائمی چیست؟</strong> با ذخیره پیکربندی در فایل <code className="font-mono text-white">public/tour-data.json</code> در پروژه و پوش (Push) به گیت‌هاب، هر دستگاهی (موبایل، تبلت، کامپیوتر مشتری) به طور خودکار این فایل را بارگذاری می‌کند و همه اطلاعات و ویدیوها بدون نیاز به هیچ تنظیم مجددی لود می‌شوند.
                    </p>
                  </div>

                  {/* Chamber Video Health Check Status */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-[#c5a880]" />
                        <span>بررسی سلامت لینک‌های ویدیو در تمام اتاق‌ها (Health Scan)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {currentProperty.rooms.map((rm) => {
                        const url = rm.videoUrl || rm.mediaUrl || '';
                        const isBlob = url.startsWith('blob:') || url.startsWith('data:');
                        const isRelative = url.startsWith('/') || url.startsWith('./');
                        const isGithub = url.includes('github');
                        const isGdrive = url.includes('drive.google.com') || url.includes('googleusercontent.com');

                        return (
                          <div
                            key={rm.id}
                            className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isBlob ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
                              <div className="truncate">
                                <span className="font-bold text-white text-[11px]">{rm.name}</span>
                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-md">
                                  {url || '(بدون ویدیو)'}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {isBlob ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-semibold border border-rose-500/30">
                                  ⚠️ موقت (در دیوایس دیگر کار نمیکند)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                                  ✅ پایدار ({isRelative ? 'مسیر پروژه' : isGithub ? 'گیت‌هاب' : isGdrive ? 'گوگل درایو' : 'مستقیم'})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Method A: Download tour-data.json for Git */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#c5a880] text-black font-bold flex items-center justify-center text-[10px]">1</span>
                        <span>روش اول: ذخیره از طریق فایل public/tour-data.json در گیت‌هاب</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">توصیه شده و آسان</span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      روی دکمه زیر کلیک کنید تا فایل کامل اطلاعات، اتاق‌ها و ویدیوها با نام <code className="text-[#c5a880]">tour-data.json</code> دانلود شود. سپس آن را در پوشه <code className="text-[#c5a880]">public/</code> پروژه خود جایگذاری کرده و به گیت‌هاب ارسال نمایید:
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          StorageService.downloadTourDataFile(properties, config);
                          showToast('فایل tour-data.json با موفقیت دانلود شد.');
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#b3956d] text-black font-bold text-xs flex items-center gap-2 shadow-lg hover:brightness-110 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>دانلود فایل tour-data.json</span>
                      </button>
                    </div>

                    <div className="p-3 bg-[#090a0f] rounded-xl font-mono text-[10px] text-slate-300 space-y-1 border border-white/10">
                      <div className="text-slate-500">// دستورات خط فرمان گیت بعد از قرار دادن فایل در پوشه public:</div>
                      <div className="text-[#c5a880]">git add public/tour-data.json</div>
                      <div className="text-[#c5a880]">git commit -m "Save tour data permanently"</div>
                      <div className="text-[#c5a880]">git push</div>
                    </div>
                  </div>

                  {/* Method B: Direct Code Replacement in src/data/properties.ts */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#c5a880] text-black font-bold flex items-center justify-center text-[10px]">2</span>
                        <span>روش دوم: جایگذاری مستقیم در کد منبع (src/data/properties.ts)</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      با این روش، اطلاعات به عنوان پیش‌فرضِ درون کدهای TypeScript ذخیره می‌شود و حتی بدون نیاز به هیچ فایل JSON یا اینترنت کار می‌کند:
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        const tsCode = StorageService.generatePropertiesTsCode(properties);
                        navigator.clipboard.writeText(tsCode);
                        setCopiedTsCode(true);
                        showToast('کدهای TypeScript در کلیپ‌بورد کپی شد!');
                        setTimeout(() => setCopiedTsCode(false), 3000);
                      }}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#c5a880] font-semibold text-xs flex items-center gap-2 border border-[#c5a880]/30 transition-all cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>{copiedTsCode ? 'کد با موفقیت کپی شد! ✅' : 'کپی کدهای آماده برای فایل src/data/properties.ts'}</span>
                    </button>
                  </div>

                  {/* Method C: Instant Backup & Cross-Device Restore */}
                  <div className="p-4 rounded-2xl bg-[#161824] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#c5a880] text-black font-bold flex items-center justify-center text-[10px]">3</span>
                        <span>روش سوم: انتقال سریع از طریق کپی و پیست بین دیوایس‌ها (Export / Import)</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const json = StorageService.exportPropertiesJson(properties);
                          navigator.clipboard.writeText(json);
                          setCopiedJsonCode(true);
                          showToast('متن JSON با موفقیت کپی شد!');
                          setTimeout(() => setCopiedJsonCode(false), 3000);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 border border-white/10 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#c5a880]" />
                        <span>{copiedJsonCode ? 'کپی شد! ✅' : 'کپی کل تنظیمات به صورت JSON'}</span>
                      </button>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] text-slate-400 block">
                        اگر در دستگاه دیگری هستید، کد JSON را در کادر زیر قرار دهید و دکمه اعمال را بزنید:
                      </label>
                      <textarea
                        rows={3}
                        value={importJsonText}
                        onChange={(e) => {
                          setImportJsonText(e.target.value);
                          setImportStatus(null);
                        }}
                        placeholder="کد JSON را اینجا Paste کنید..."
                        className="w-full bg-[#090a0f] border border-white/15 rounded-xl p-3 text-white font-mono text-[11px] focus:outline-none focus:border-[#c5a880]"
                      />
                      {importStatus && (
                        <div className="text-[11px] text-amber-300 font-medium">
                          {importStatus}
                        </div>
                      )}
                      {importJsonText && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const parsed = StorageService.importPropertiesJson(importJsonText);
                              await StorageService.saveProperties(parsed);
                              showToast('تنظیمات با موفقیت روی این دستگاه اعمال و ذخیره شد!');
                              setImportStatus('✅ تنظیمات با موفقیت ذخیره شد. در حال بارگذاری مجدد...');
                              setTimeout(() => window.location.reload(), 1200);
                            } catch (err: any) {
                              setImportStatus(`❌ خطا در اعتبارسنجی JSON: ${err.message}`);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>اعمال تنظیمات روی این دستگاه</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-[#161824] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Need more diagnostics? Check the <strong>Video Optimizer Studio</strong> tab.
              </span>
              <button
                type="button"
                onClick={() => setShowVideoHostingModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WordPress Media Library Modal for picking images/videos */}
      <MediaLibraryModal
        isOpen={showMediaModal}
        onClose={() => {
          setShowMediaModal(false);
          setMediaTargetField(null);
        }}
        onSelect={handleSelectMedia}
        onSelectMedia={handleSelectMedia}
        title="VibeTour Pro Media Library"
      />
    </div>
  );
};
