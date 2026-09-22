import React, { useState, useEffect } from 'react';
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
  TrendingUp
} from 'lucide-react';
import { PropertyListing, Room, PluginConfig, AdminUser, Hotspot, MaterialItem, ActiveTab } from '../types';
import { authService, StoredCredentials } from '../utils/authService';
import { MediaLibraryModal, SAMPLE_WP_MEDIA } from './MediaLibraryModal';
import { soundEngine } from '../utils/audioSynth';

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

  // Login Form States
  const [loginMode, setLoginMode] = useState<'gmail' | 'credentials'>('gmail');
  const [usernameInput, setUsernameInput] = useState<string>('admin');
  const [passwordInput, setPasswordInput] = useState<string>('admin');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [customGmail, setCustomGmail] = useState<string>('kazeme.javad@gmail.com');

  // Dashboard Active Tab
  const [adminTab, setAdminTab] = useState<AdminTab>('profiles');

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Security Credentials Form States
  const [currentPasswordForUpdate, setCurrentPasswordForUpdate] = useState<string>('');
  const [newUsernameInput, setNewUsernameInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [securityStatus, setSecurityStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  // Media Library Modal
  const [showMediaModal, setShowMediaModal] = useState<boolean>(false);
  const [mediaTargetField, setMediaTargetField] = useState<{ type: 'propertyHero' | 'roomVideo' | 'roomThumb' | 'brokerAvatar' | 'newProfileHero'; roomId?: string } | null>(null);

  // New Property Profile Creation Modal States
  const [showAddProfileModal, setShowAddProfileModal] = useState<boolean>(false);
  const [newPropTitle, setNewPropTitle] = useState<string>('');
  const [newPropTitleFa, setNewPropTitleFa] = useState<string>('');
  const [newPropPrice, setNewPropPrice] = useState<string>('$38,500,000');
  const [newPropLocation, setNewPropLocation] = useState<string>('تهران، الهیه، فرشته');
  const [newPropBeds, setNewPropBeds] = useState<number>(5);
  const [newPropBaths, setNewPropBaths] = useState<number>(6);
  const [newPropSqft, setNewPropSqft] = useState<number>(10800);
  const [newPropHero, setNewPropHero] = useState<string>('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80');

  // Selected Room for Video Editor
  const [selectedRoomId, setSelectedRoomId] = useState<string>(currentProperty.rooms[0]?.id || '');
  const selectedRoom = currentProperty.rooms.find((r) => r.id === selectedRoomId) || currentProperty.rooms[0];

  // Initialize session on mount
  useEffect(() => {
    const session = authService.getSession();
    if (session.isAuthenticated && session.user) {
      setIsAuthenticated(true);
      setCurrentUser(session.user);
      setNewUsernameInput(session.user.username);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    soundEngine.triggerHapticChime(580);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Login with Credentials
  const handleCredentialsLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    setTimeout(() => {
      const res = authService.loginWithCredentials(usernameInput, passwordInput);
      if (res.success && res.user) {
        setIsAuthenticated(true);
        setCurrentUser(res.user);
        setNewUsernameInput(res.user.username);
        if (onAuthChange) onAuthChange(true);
        showToast('ورود با موفقیت انجام شد. به پنل مدیریت خوش آمدید.');
      } else {
        setLoginError(res.error || 'اطلاعات ورود اشتباه است.');
        soundEngine.triggerHapticChime(320);
      }
      setIsLoggingIn(false);
    }, 400);
  };

  // Login with Google / Gmail
  const handleGoogleLogin = (emailToUse?: string) => {
    setIsLoggingIn(true);
    setLoginError(null);

    setTimeout(() => {
      const targetEmail = emailToUse || customGmail || 'kazeme.javad@gmail.com';
      const res = authService.loginWithGoogle(targetEmail);
      if (res.success && res.user) {
        setIsAuthenticated(true);
        setCurrentUser(res.user);
        setNewUsernameInput(res.user.username);
        if (onAuthChange) onAuthChange(true);
        showToast(`ورود با حساب گوگل (${targetEmail}) با موفقیت تایید شد.`);
      }
      setIsLoggingIn(false);
    }, 500);
  };

  // Logout
  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    if (onAuthChange) onAuthChange(false);
    showToast('از حساب کاربری خارج شدید.');
  };

  // Change Credentials (Username & Password)
  const handleUpdateCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityStatus({ type: 'idle', message: '' });

    if (newPasswordInput && newPasswordInput !== confirmPasswordInput) {
      setSecurityStatus({
        type: 'error',
        message: 'رمز عبور جدید با تکرار آن همخوانی ندارد.',
      });
      soundEngine.triggerHapticChime(320);
      return;
    }

    const currentCreds = authService.getCredentials();
    const finalPasswordToSet = newPasswordInput ? newPasswordInput : currentCreds.password;
    const finalUsernameToSet = newUsernameInput ? newUsernameInput : currentCreds.username;

    const res = authService.updateCredentials(
      currentPasswordForUpdate,
      finalUsernameToSet,
      finalPasswordToSet
    );

    if (res.success) {
      setSecurityStatus({
        type: 'success',
        message: 'نام کاربری و رمز عبور با موفقیت به‌روزرسانی شدند.',
      });
      setCurrentPasswordForUpdate('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      showToast('مشخصات حساب جدید در سیستم ذخیره گردید.');
    } else {
      setSecurityStatus({
        type: 'error',
        message: res.error || 'خطا در تغییر مشخصات.',
      });
      soundEngine.triggerHapticChime(320);
    }
  };

  // Reset Credentials to factory default (admin / admin)
  const handleResetToDefault = () => {
    if (window.confirm('آیا از بازنشانی نام کاربری و رمز عبور به حالت پیش‌فرض (admin / admin) اطمینان دارید؟')) {
      authService.resetToDefaultCredentials();
      setUsernameInput('admin');
      setPasswordInput('admin');
      setNewUsernameInput('admin');
      setCurrentPasswordForUpdate('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setSecurityStatus({
        type: 'success',
        message: 'مشخصات ورود به حالت اولیه کارخانه (نام کاربری admin / رمز admin) بازنشانی شد.',
      });
      showToast('اطلاعات ورود به حالت پیش‌فرض بازگردانی شد.');
    }
  };

  // Property & Facade field updater
  const handleUpdatePropertyField = (field: keyof PropertyListing, value: any) => {
    const updated = {
      ...currentProperty,
      [field]: value,
    };
    onUpdateProperty(updated);
    showToast(`تغییرات بخش «${String(field)}» ذخیره گردید.`);
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
    showToast('تنظیمات فضا و ویدیو به‌روز شد.');
  };

  // Broker & Personnel field updater (تنظیمات مشاور، عکس افراد و متن‌ها)
  const handleUpdateBrokerField = (field: string, value: string) => {
    const updated = {
      ...currentProperty,
      broker: {
        ...currentProperty.broker,
        [field]: value
      }
    };
    onUpdateProperty(updated);
    showToast(`مشخصات مشاور (${field}) ذخیره گردید.`);
  };

  // Add new property profile
  const handleCreateProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropTitle.trim()) {
      showToast('لطفاً عنوان انگلیسی یا لاتین ملک را وارد نمایید.');
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
      subtitleFa: 'عمارت باشکوه با تور تعاملی سینمایی',
      tagline: 'Exclusive Architectural Trophy Estate',
      location: newPropLocation.trim() || 'تهران، زعفرانیه',
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
        name: currentProperty.broker?.name || 'مهندس جواد کاظمی',
        title: 'مدیر ارشد کارگزاری املاک لوکس',
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
    showToast(`پروفایل جدید «${newProp.titleFa}» افزوده و فعال گردید.`);
  };

  // Duplicate an existing property profile
  const handleDuplicateProperty = (p: PropertyListing) => {
    const id = 'prop-' + Date.now();
    const dup: PropertyListing = {
      ...p,
      id,
      title: `${p.title} (Clone)`,
      titleFa: `${p.titleFa || p.title} (نسخه جدید)`,
      mlsNumber: 'VBT-' + Math.floor(100000 + Math.random() * 900000),
      rooms: p.rooms.map((r, idx) => ({ ...r, id: `${id}-room-${idx + 1}` }))
    };
    if (onAddProperty) onAddProperty(dup);
    onSelectProperty(dup);
    showToast('پروفایل با موفقیت تکثیر شد.');
  };

  // Delete property profile
  const handleDeletePropertyConfirm = (id: string, name: string) => {
    if (properties.length <= 1) {
      alert('حداقل یک پروفایل ملک باید در سامانه باقی بماند.');
      return;
    }
    if (window.confirm(`آیا از حذف پروفایل «${name}» اطمینان دارید؟`)) {
      if (onDeleteProperty) onDeleteProperty(id);
      showToast(`پروفایل «${name}» حذف گردید.`);
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
    showToast('فایل پشتیبان تنظیمات با موفقیت دانلود شد.');
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
              <span>مرکز کنترل و مدیریت VibeTour Pro</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
              ورود به داشبورد مدیریت
            </h2>
            <p className="text-xs text-slate-300 font-light max-w-md mx-auto leading-relaxed">
              جهت اعمال تغییرات بر روی نمای عمارت، ویدیوهای تور، نقاط ایستگاه و تنظیمات حرکتی، با حساب جیمیل یا نام کاربری وارد شوید.
            </p>
          </div>

          {/* Login Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#12141f] rounded-2xl border border-white/10 text-xs font-semibold">
            <button
              onClick={() => {
                setLoginMode('gmail');
                setLoginError(null);
              }}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                loginMode === 'gmail'
                  ? 'bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black shadow-lg font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>ورود با جیمیل (Google)</span>
            </button>

            <button
              onClick={() => {
                setLoginMode('credentials');
                setLoginError(null);
              }}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                loginMode === 'credentials'
                  ? 'bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black shadow-lg font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>نام کاربری و رمز عبور</span>
            </button>
          </div>

          {/* Error Message */}
          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* TAB 1: GMAIL & GOOGLE AUTHENTICATION */}
          {loginMode === 'gmail' && (
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
                        <span className="text-sm font-bold text-white">جواد کاظمی</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                          مدیر ارشد
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
                  onClick={() => handleGoogleLogin('kazeme.javad@gmail.com')}
                  disabled={isLoggingIn}
                  className="w-full py-2.5 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#c5a880]/20"
                >
                  <Mail className="w-4 h-4" />
                  <span>ورود مستقیم با این حساب جیمیل (Sign in with Google)</span>
                </button>
              </div>

              {/* Or enter alternative Gmail */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-slate-300 block">یا ورود با آدرس جیمیل دیگر:</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={customGmail}
                    onChange={(e) => setCustomGmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="flex-1 bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                  <button
                    type="button"
                    onClick={() => handleGoogleLogin(customGmail)}
                    disabled={isLoggingIn}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/20"
                  >
                    ورود
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#c5a880] shrink-0" />
                <span>احراز هویت از طریق پروتکل امن گوگل با دسترسی مدیر ارشد برای ویرایش مشخصات نما و ویدیوها صورت می‌پذیرد.</span>
              </div>
            </div>
          )}

          {/* TAB 2: USERNAME & PASSWORD AUTHENTICATION */}
          {loginMode === 'credentials' && (
            <form onSubmit={handleCredentialsLogin} className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#c5a880]" />
                  <span>نام کاربری (Username):</span>
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#c5a880]" />
                    <span>رمز عبور (Password):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPassword ? 'پنهان کردن' : 'نمایش'}</span>
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono"
                />
              </div>

              {/* Helper box with default credentials info */}
              <div className="p-3 rounded-xl bg-[#c5a880]/10 border border-[#c5a880]/30 text-xs text-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#c5a880]">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>اطلاعات ورود پیش‌فرض مدیر سامانه:</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] pt-1">
                  <span>نام کاربری: <strong className="text-white">admin</strong></span>
                  <span>رمز عبور: <strong className="text-white">admin</strong> (یا admin123)</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] hover:from-[#e6d5bd] hover:to-[#c5a880] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#c5a880]/20"
              >
                <Key className="w-4 h-4" />
                <span>{isLoggingIn ? 'در حال تایید اعتبار...' : 'ورود به پنل مدیریت'}</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/10">
                <span>امکان تغییر نام کاربری و رمز در داخل داشبورد فراهم است.</span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[#c5a880] hover:underline"
                >
                  بازنشانی به پیش‌فرض
                </button>
              </div>
            </form>
          )}

          {/* Return link */}
          <div className="text-center pt-2">
            <button
              onClick={onNavigateToWalkthrough}
              className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto transition-colors"
            >
              <span>بازگشت به تور بازدید زنده</span>
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
                {currentUser?.displayName || 'مدیر کل سامانه'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#c5a880]/20 text-[#c5a880] text-[10px] font-mono font-bold border border-[#c5a880]/40">
                {currentUser?.role || 'Super Admin'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span className="font-mono text-[11px] text-[#e6d5bd]">
                {currentUser?.email ? currentUser.email : `یوزر: ${currentUser?.username}`}
              </span>
              <span>•</span>
              <span className="text-[11px] text-slate-400">
                روش ورود: {currentUser?.authProvider === 'google' ? 'جیمیل تایید شده' : 'نام کاربری/رمز'}
              </span>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setAdminTab('security')}
            className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all ${
              adminTab === 'security'
                ? 'bg-[#c5a880] text-black font-bold shadow'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-[#c5a880]" />
            <span>تغییر رمز و یوزر</span>
          </button>

          <button
            onClick={onNavigateToWalkthrough}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/20"
          >
            <Compass className="w-3.5 h-3.5 text-[#c5a880]" />
            <span>مشاهده تور زنده</span>
          </button>

          <button
            onClick={handleExportJSON}
            title="دانلود نسخه پشتیبان تنظیمات JSON"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/10"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all border border-rose-500/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
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
          <span>پروفایل‌ها، مشاور و متن‌ها (Profiles & Agent)</span>
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
          <span>تنظیمات و تغییرات نما (Exterior Facade)</span>
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
          <span>تنظیمات ویدیوها و فضاها (Video Chambers)</span>
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
          <span>موتور حرکتی، سرعت و تم</span>
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
          <span>ابزارهای پیشرفته و المنتور (Builder & Tools)</span>
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
          <span>امنیت، تغییر یوزر/رمز و جیمیل</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 0: PROPERTY PROFILES, AGENT & TEXTS (پروفایل‌ها، مشاور و متن‌ها) */}
      {/* ======================================================== */}
      {adminTab === 'profiles' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl vbt-glass border border-white/10 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#c5a880]" />
                <h3 className="text-base font-bold text-white">
                  مدیریت پروفایل‌های املاک، مشاور و متن‌ها
                </h3>
              </div>
              <p className="text-xs text-slate-300">
                این بخش منحصراً برای مدیر کل فعال است. افزودن ملک جدید، ویرایش اطلاعات و تصویر مشاورین و متون معرفی در این بخش انجام می‌شود.
              </p>
            </div>

            <button
              onClick={() => setShowAddProfileModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#b3956d] text-black font-bold text-xs flex items-center gap-2 shadow-lg hover:scale-105 transition-transform shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن ملک و پروفایل جدید</span>
            </button>
          </div>

          {/* Properties Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#c5a880]" />
                <span>لیست املاک ثبت‌شده در سامانه ({properties.length} ملک):</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                جهت فعال‌سازی هر ملک در تور، روی «انتخاب جهت ویرایش و تور» کلیک کنید.
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
                          <span>ملک فعال در تور</span>
                        </div>
                      )}

                      {/* Specs Badge */}
                      <div className="absolute bottom-2 right-2.5 text-[11px] text-slate-200 flex items-center gap-2">
                        <span>{prop.beds} خواب</span>
                        <span>•</span>
                        <span>{prop.baths} حمام</span>
                        <span>•</span>
                        <span>{prop.sqft.toLocaleString()} فوت مربع</span>
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
                            showToast(`ملک «${prop.titleFa || prop.title}» جهت ویرایش و تور انتخاب شد.`);
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                            isActive
                              ? 'bg-[#c5a880] text-black font-bold'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{isActive ? 'در حال ویرایش' : 'انتخاب ملک'}</span>
                        </button>

                        <button
                          onClick={() => handleDuplicateProperty(prop)}
                          title="تکثیر این پروفایل ملک"
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors border border-white/10"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {properties.length > 1 && (
                          <button
                            onClick={() => handleDeletePropertyConfirm(prop.id, prop.titleFa || prop.title)}
                            title="حذف این پروفایل ملک"
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
                  ویرایش مشخصات و متن‌های ملک فعال: «{currentProperty.titleFa || currentProperty.title}»
                </h4>
              </div>
              <span className="text-xs font-mono text-[#c5a880]">ID: {currentProperty.id}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Titles & Texts Column */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">عنوان ملک به فارسی:</label>
                  <input
                    type="text"
                    value={currentProperty.titleFa || ''}
                    onChange={(e) => handleUpdatePropertyField('titleFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">عنوان ملک به انگلیسی (لاتین):</label>
                  <input
                    type="text"
                    value={currentProperty.title}
                    onChange={(e) => handleUpdatePropertyField('title', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">قیمت نمایشی:</label>
                    <input
                      type="text"
                      value={currentProperty.price}
                      onChange={(e) => handleUpdatePropertyField('price', e.target.value)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">موقعیت و آدرس:</label>
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
                    <label className="text-xs text-slate-300">تعداد خواب:</label>
                    <input
                      type="number"
                      value={currentProperty.beds}
                      onChange={(e) => handleUpdatePropertyField('beds', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">تعداد سرویس:</label>
                    <input
                      type="number"
                      value={currentProperty.baths}
                      onChange={(e) => handleUpdatePropertyField('baths', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">متراژ (فوت/متر):</label>
                    <input
                      type="number"
                      value={currentProperty.sqft}
                      onChange={(e) => handleUpdatePropertyField('sqft', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">زیرعنوان و توضیحات معرفی:</label>
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
                <label className="text-xs text-slate-300 block">تصویر شاخص و کاور نما (Hero Image):</label>
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
                      <span>تغییر تصویر از کتابخانه رسانه</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">آدرس مستقیم تصویر (URL):</label>
                  <input
                    type="text"
                    value={currentProperty.heroImage}
                    onChange={(e) => handleUpdatePropertyField('heroImage', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>
              </div>

            </div>

            {/* SECTION: BROKER, AGENT & PERSONNEL SETTINGS (تنظیمات مشاور، عکس افراد و متن‌ها) */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#c5a880]" />
                  <h4 className="text-xs font-bold text-white">
                    اطلاعات کارشناس، تصویر افراد و مشاور اختصاصی معرفی ملک
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">تنظیمات کارت پرسنلی و مشاور</span>
              </div>

              <div className="p-5 rounded-2xl bg-[#141624] border border-white/10 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                
                {/* Agent Avatar Preview and Uploader */}
                <div className="md:col-span-4 flex flex-col items-center text-center space-y-3">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#c5a880] shadow-xl bg-black">
                    <img
                      src={currentProperty.broker?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
                      alt={currentProperty.broker?.name || 'مشاور'}
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
                    <span>تغییر تصویر چهره مشاور</span>
                  </button>
                  <span className="text-[10px] text-slate-400">عکس پرتره باکیفیت مشاور</span>
                </div>

                {/* Agent Text Fields */}
                <div className="md:col-span-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">نام و نام خانوادگی کارشناس:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.name || ''}
                        placeholder="مهندس جواد کاظمی"
                        onChange={(e) => handleUpdateBrokerField('name', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">سمت سازمانی و عنوان:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.title || ''}
                        placeholder="مدیر ارشد کارگزاری املاک لوکس"
                        onChange={(e) => handleUpdateBrokerField('title', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">آژانس / هلدینگ:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.agency || ''}
                        placeholder="VibeTour Sotheby’s"
                        onChange={(e) => handleUpdateBrokerField('agency', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">شماره تماس مستقیم:</label>
                      <input
                        type="text"
                        value={currentProperty.broker?.phone || ''}
                        placeholder="+98 912 000 0000"
                        onChange={(e) => handleUpdateBrokerField('phone', e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">ایمیل مشاور:</label>
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
                    <label className="text-[11px] text-slate-400">آدرس مستقیم تصویر آواتار:</label>
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
                    <h3 className="text-sm font-bold text-white">افزودن و ثبت پروفایل ملک جدید</h3>
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
                      <label className="text-xs text-slate-300">عنوان فارسی ملک:</label>
                      <input
                        type="text"
                        required
                        value={newPropTitleFa}
                        placeholder="عمارت کینتیک الهیه"
                        onChange={(e) => setNewPropTitleFa(e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">عنوان انگلیسی ملک:</label>
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
                      <label className="text-xs text-slate-300">قیمت پیشنهادی:</label>
                      <input
                        type="text"
                        value={newPropPrice}
                        placeholder="$35,000,000"
                        onChange={(e) => setNewPropPrice(e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">موقعیت و منطقه:</label>
                      <input
                        type="text"
                        value={newPropLocation}
                        placeholder="تهران، زعفرانیه"
                        onChange={(e) => setNewPropLocation(e.target.value)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">تعداد اتاق:</label>
                      <input
                        type="number"
                        value={newPropBeds}
                        onChange={(e) => setNewPropBeds(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">سرویس بهداشتی:</label>
                      <input
                        type="number"
                        value={newPropBaths}
                        onChange={(e) => setNewPropBaths(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">متراژ (فوت مربع):</label>
                      <input
                        type="number"
                        value={newPropSqft}
                        onChange={(e) => setNewPropSqft(parseInt(e.target.value) || 1000)}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">آدرس تصویر کاور نما:</label>
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
                        کتابخانه
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddProfileModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#c5a880] text-black font-bold text-xs shadow-lg hover:scale-105 transition-transform"
                    >
                      ثبت و فعال‌سازی ملک در سامانه
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: FACADE & ARCHITECTURAL STYLING SETTINGS (تنظیمات نما) */}
      {/* ======================================================== */}
      {adminTab === 'facade' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          
          {/* Left Column: Visual Facade Preview & Media Links (5 Cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="vbt-glass p-5 rounded-2xl border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#c5a880]" />
                  <h3 className="text-sm font-bold text-white">تصویر و ویدیوی نمای عمارت</h3>
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
                    نمای اصلی بنا • ۴K
                  </span>
                  <p className="text-xs font-bold text-white truncate">{currentProperty.titleFa || currentProperty.title}</p>
                </div>
              </div>

              {/* Image URL Input & Library Button */}
              <div className="space-y-2">
                <label className="text-xs text-slate-300 block">لینک مستقیم تصویر نمای بیرونی (Hero Image):</label>
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
                    <span>کتابخانه</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Facade Images */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="text-[10px] text-slate-400 block">نمونه نماهای لوکس آماده:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'نمای شیشه‌ای مدرن',
                      url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      label: 'ویلا ساحلی مدیترانه',
                      url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      label: 'عمارت کاخ کلاسیک',
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
                <h4 className="text-xs font-bold text-white">متریال‌های به کار رفته در نما</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#141624] border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium block">سنگ تراورتن ناونا رومی</span>
                    <span className="text-[10px] text-slate-400">مبدا: تیوولی، ایتالیا • پرداخت مات هوند</span>
                  </div>
                  <span className="text-[10px] text-[#c5a880] font-mono font-bold">A++ Luxury</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#141624] border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium block">شیشه سه‌جداره خمیده لوئی</span>
                    <span className="text-[10px] text-slate-400">سنت گوبن فرانسه با فیلتر آکوستیک و UV</span>
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
                  <h3 className="text-sm font-bold text-white">مشخصات هویتی و معماری نما</h3>
                </div>
                <span className="text-[10px] text-slate-400">ذخیره خودکار در تور</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">عنوان پروژه (انگلیسی):</label>
                  <input
                    type="text"
                    value={currentProperty.title}
                    onChange={(e) => handleUpdatePropertyField('title', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">عنوان فارسی نما و عمارت:</label>
                  <input
                    type="text"
                    value={currentProperty.titleFa || ''}
                    placeholder="اسکای ویلا پورت هرکول"
                    onChange={(e) => handleUpdatePropertyField('titleFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">قیمت نمایشی:</label>
                  <input
                    type="text"
                    value={currentProperty.price}
                    onChange={(e) => handleUpdatePropertyField('price', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">موقعیت مکانی (Location):</label>
                  <input
                    type="text"
                    value={currentProperty.location}
                    onChange={(e) => handleUpdatePropertyField('location', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">متراژ زیربنا (Sq Ft):</label>
                  <input
                    type="number"
                    value={currentProperty.sqft}
                    onChange={(e) => handleUpdatePropertyField('sqft', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">معمار طراح (Architect):</label>
                  <input
                    type="text"
                    value={currentProperty.architect}
                    onChange={(e) => handleUpdatePropertyField('architect', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">تعداد سوئیت خواب (Beds):</label>
                  <input
                    type="number"
                    value={currentProperty.beds}
                    onChange={(e) => handleUpdatePropertyField('beds', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">تعداد حمام و سرویس (Baths):</label>
                  <input
                    type="number"
                    value={currentProperty.baths}
                    onChange={(e) => handleUpdatePropertyField('baths', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <label className="text-xs text-slate-300">تگ‌لاین و معرفی سبک معماری:</label>
                <input
                  type="text"
                  value={currentProperty.tagline}
                  onChange={(e) => handleUpdatePropertyField('tagline', e.target.value)}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">زیرعنوان توصیفی نما:</label>
                <textarea
                  rows={2}
                  value={currentProperty.subtitleFa || currentProperty.subtitle}
                  onChange={(e) => handleUpdatePropertyField('subtitleFa', e.target.value)}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880] resize-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">تمام تغییرات مستقیماً در تور ویدیویی رندر می‌شود.</span>
                <button
                  type="button"
                  onClick={onNavigateToWalkthrough}
                  className="px-4 py-2 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>مشاهده نتیجه روی نما</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: VIDEOS & CHAMBERS MANAGEMENT (تنظیمات ویدیوها و فضاها) */}
      {/* ======================================================== */}
      {adminTab === 'videos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          
          {/* Chamber Selector List (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="vbt-glass p-5 rounded-2xl border border-white/10 space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#c5a880]" />
                  <h3 className="text-xs font-bold text-white">فهرست فضاها و ویدیوها</h3>
                </div>
                <span className="text-[10px] font-mono text-[#c5a880] font-bold">
                  {currentProperty.rooms.length} فضا
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
                          {room.enablePauseGate ? 'دارای توقف خودکار اسکرول' : 'پیمایش پیوسته'}
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
                    تنظیمات فضا و ویدیوی اختصاصی
                  </span>
                  <h3 className="font-display text-base sm:text-lg font-bold text-white mt-0.5">
                    {selectedRoom.nameFa || selectedRoom.name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">نوع مدیا:</span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">
                    {selectedRoom.mediaType.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Video Player Live Preview */}
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black shadow-lg">
                <video
                  key={selectedRoom.videoUrl || selectedRoom.mediaUrl}
                  src={selectedRoom.videoUrl || selectedRoom.mediaUrl}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Video URL Config */}
              <div className="space-y-2">
                <label className="text-xs text-slate-300 block">
                  آدرس ویدیوی این فضا (MP4 / WebM / Sequence):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedRoom.videoUrl || selectedRoom.mediaUrl}
                    onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'videoUrl', e.target.value)}
                    className="flex-1 bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTargetField({ type: 'roomVideo', roomId: selectedRoom.id });
                      setShowMediaModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>انتخاب ویدیو</span>
                  </button>
                </div>
              </div>

              {/* Checkpoint Decision Gate Config (ایستگاه توقف خودکار اسکرول و منوی ورود) */}
              <div className="p-4 rounded-2xl bg-[#141624] border border-[#c5a880]/40 space-y-3 shadow-lg">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-[#c5a880]" />
                    <span className="text-xs font-bold text-white">
                      توقف خودکار اسکرول و نمایش منوی ورود به اتاق‌ها (Pause Gate)
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
                  هنگامی که کاربر در حال اسکرول کردن روی این ویدیو است، حرکت در درصد تعیین شده کاملاً متوقف و قفل می‌شود و منوی انتخاب فضاها باز می‌شود تا مقصد بعدی تعیین گردد.
                </p>

                {selectedRoom.enablePauseGate && (
                  <div className="space-y-3 pt-2 border-t border-white/10 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">درصد وقوع توقف روی ویدیو:</span>
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
                      <label className="text-xs text-slate-400">متن عنوان پیام در لحظه توقف:</label>
                      <input
                        type="text"
                        value={selectedRoom.pauseGateTitleFa || ''}
                        placeholder="به تقاطع فضاهای عمارت رسیدید؛ انتخاب مقصد بعدی برای ورود:"
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
                  <label className="text-xs text-slate-300">عنوان فضا (فارسی):</label>
                  <input
                    type="text"
                    value={selectedRoom.nameFa || ''}
                    placeholder="سالن پذیرایی گرند صالون"
                    onChange={(e) => handleUpdateRoomField(selectedRoom.id, 'nameFa', e.target.value)}
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">زیرعنوان یا توضیحات کوتاه:</label>
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
      {/* TAB 3: MOTION, KINETIC & SCROLL ENGINE (تنظیمات حرکتی و سرعت) */}
      {/* ======================================================== */}
      {adminTab === 'motion' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
          <div className="vbt-glass p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Gauge className="w-5 h-5 text-[#c5a880]" />
                <div>
                  <h3 className="text-base font-bold text-white">تنظیمات سرعت اسکرول و موتور حرکتی سینمایی</h3>
                  <p className="text-xs text-slate-400">کنترل حساسیت چرخ ماوس، پیمایش لمسی و اینرسی GSAP</p>
                </div>
              </div>
              <span className="font-mono text-sm text-[#c5a880] font-bold">
                {((config.scrollSpeedFactor || 0.45) * 100).toFixed(0)}% Speed
              </span>
            </div>

            {/* Scroll Speed Factor with Presets */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-white block">
                حالت‌های پیش‌فرض سرعت اسکرول:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: '۰.۲۵x اسلوموشن بسیار آرام', val: 0.25, desc: 'Ultra Slow' },
                  { label: '۰.۴۵x سینمایی لوکس', val: 0.45, desc: 'Cinematic Default' },
                  { label: '۰.۸۰x متعادل و طبیعی', val: 0.8, desc: 'Balanced' },
                  { label: '۱.۲۰x سریع و واکنشی', val: 1.2, desc: 'Fast Responsive' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => {
                      onUpdateConfig({ ...config, scrollSpeedFactor: item.val });
                      showToast(`سرعت اسکرول به ${item.val}x تنظیم شد.`);
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all ${
                      Math.abs((config.scrollSpeedFactor || 0.45) - item.val) < 0.05
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
                  <span className="text-slate-400">تنظیم دقیق ضریب سرعت:</span>
                  <span className="font-mono text-[#c5a880] font-bold">
                    {(config.scrollSpeedFactor || 0.45).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={config.scrollSpeedFactor || 0.45}
                  onChange={(e) => onUpdateConfig({ ...config, scrollSpeedFactor: parseFloat(e.target.value) })}
                  className="w-full accent-[#c5a880] cursor-pointer h-2"
                />
              </div>
            </div>

            {/* Checkpoint Gates Global Toggle */}
            <div className="p-4 rounded-2xl bg-[#141624] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  فعال‌سازی سراسری ایستگاه‌های توقف خودکار برای تمام فضاها
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  هنگام رسیدن به آستانه هر اتاق، اسکرول متوقف و قفل شده و پنجره انتخاب مقصد ظاهر می‌شود.
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
                <span className="text-slate-300">ضریب اینرسی و نرمی حرکت GSAP (Scrub Smoothing):</span>
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
                <span className="text-xs font-bold text-white block">افکت‌های صوتی هاپتیک و صدای محیط</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">پخش چایم‌های لوکس در هنگام عبور از ایستگاه‌ها یا کلیک بر روی گزینه‌ها</span>
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
      {/* TAB 4: ADVANCED TOOLS & ELEMENTOR BUILDER (ابزارهای پیشرفته و المنتور) */}
      {/* ======================================================== */}
      {adminTab === 'tools' && (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
          
          <div className="p-5 rounded-3xl vbt-glass border border-white/10 shadow-xl space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#c5a880]" />
              <h3 className="text-base font-bold text-white">
                ابزارهای پیشرفته مدیریت، استودیو المنتور و خروجی وردپرس
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              دسترسی به بخش‌های تخصصی پلتفرم شامل استودیو المنتور، موتور تست ویدیوهای 4K، بسته‌های افزونه وردپرس و مدل‌های بازگشت سرمایه مخصوص مدیر کل.
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
                  <h4 className="text-sm font-bold text-white">استودیو شخصی‌سازی زنده المنتور (Elementor Studio)</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    تنظیمات بی‌درنگ فونت، پالت رنگی طلایی و نئوکلاسیک، ابعاد دکمه‌ها و استایل‌های پنل مشخصات پروژه مستقیماً در ویرایشگر المنتور.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('elementor_builder')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#b3956d] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
              >
                <span>ورود به استودیو المنتور</span>
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
                  <h4 className="text-sm font-bold text-white">تست و بهینه‌ساز ویدیوهای 4K و فضاها</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    بررسی هماهنگی کدک‌های H.264 / AV1، تست راندمان بافرینگ و تضمین نرخ فریم ۶۰ فریم بر ثانیه برای نمایش روان تور در مرورگرهای موبایل و دسکتاپ.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('video_optimizer')}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
              >
                <span>ورود به بهینه‌ساز ویدیو</span>
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
                  <h4 className="text-sm font-bold text-white">پکیج و سورس افزونه وردپرس (WordPress Plugin & ZIP)</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    مشاهده سورس کدهای کامل PHP، ساختار ماژولار شورت‌کدها و دانلود فایل زیپ کامل افزونه جهت نصب مستقیم در پنل مدیریت وردپرس.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('plugin_code')}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
              >
                <span>مشاهده کد و دانلود ZIP افزونه</span>
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
                  <h4 className="text-sm font-bold text-white">مدل اقتصادی و بازگشت سرمایه کارگزاری (Broker ROI)</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    تحلیل دقیق نرخ بازگشت سرمایه، محاسبه افزایش ۳۰۰٪ ماندگاری بازدیدکنندگان و نرخ تبدیل سرنخ‌های مشتریان میلیاردی املاک لوکس.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('broker_roi')}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
              >
                <span>مشاهده تحلیل بازگشت سرمایه</span>
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: SECURITY, USERNAME & PASSWORD MANAGEMENT (تغییر رمز و یوزر) */}
      {/* ======================================================== */}
      {adminTab === 'security' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
          
          {/* Main Credentials Change Card */}
          <div className="vbt-glass p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-[#c5a880]" />
                <div>
                  <h3 className="text-base font-bold text-white">تغییر نام کاربری و رمز عبور مدیر سامانه</h3>
                  <p className="text-xs text-slate-400">به‌روزرسانی مشخصات ورود و مدیریت کلیدهای دسترسی</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                حفاظت امنیتی فعال
              </span>
            </div>

            {/* Status Message */}
            {securityStatus.type !== 'idle' && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in ${
                  securityStatus.type === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
                }`}
              >
                {securityStatus.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{securityStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCredentials} className="space-y-4">
              
              {/* New Username Field */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#c5a880]" />
                  <span>نام کاربری جدید (Username):</span>
                </label>
                <input
                  type="text"
                  value={newUsernameInput}
                  onChange={(e) => setNewUsernameInput(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono"
                />
              </div>

              {/* Current Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#c5a880]" />
                  <span>رمز عبور فعلی جهت تایید هویت:</span>
                </label>
                <input
                  type="password"
                  value={currentPasswordForUpdate}
                  onChange={(e) => setCurrentPasswordForUpdate(e.target.value)}
                  placeholder="رمز فعلی (پیش‌فرض: admin)"
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono"
                />
                <span className="text-[10px] text-slate-400 block">
                  اگر رمز را قبلاً تغییر نداده‌اید، رمز فعلی <strong className="text-[#c5a880]">admin</strong> می‌باشد.
                </span>
              </div>

              {/* New Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">رمز عبور جدید (اختیاری):</label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="کلمه عبور جدید..."
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">تکرار رمز عبور جدید:</label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="تکرار کلمه عبور..."
                    className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#c5a880] font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#8c6d46] hover:from-[#e6d5bd] hover:to-[#c5a880] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-[#c5a880]/20"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره تغییرات نام کاربری و رمز عبور</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازنشانی به پیش‌فرض (admin / admin)</span>
                </button>
              </div>
            </form>
          </div>

          {/* Connected Google & Gmail Account Status */}
          <div className="vbt-glass p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#c5a880]" />
                <h4 className="text-xs font-bold text-white">اتصال و همگام‌سازی با حساب گوگل و جیمیل</h4>
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
                  <span className="text-xs font-bold text-white block">حساب جیمیل مدیر کل:</span>
                  <span className="text-xs font-mono text-[#c5a880]">kazeme.javad@gmail.com</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleGoogleLogin('kazeme.javad@gmail.com');
                  showToast('حساب جیمیل بازتایید و همگام شد.');
                }}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/20"
              >
                تایید مجدد جیمیل
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
        title="کتابخانه چندرسانه‌ای VibeTour"
      />
    </div>
  );
};
