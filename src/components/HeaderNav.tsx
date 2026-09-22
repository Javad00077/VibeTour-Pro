import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Sliders, 
  FolderArchive, 
  TrendingUp, 
  Building2, 
  Sparkles, 
  ShieldCheck,
  ChevronDown,
  Shield,
  Key,
  User,
  Lock
} from 'lucide-react';
import { PropertyListing, ActiveTab } from '../types';
import { authService } from '../utils/authService';

interface HeaderNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  properties: PropertyListing[];
  currentProperty: PropertyListing;
  onSelectProperty: (property: PropertyListing) => void;
  isAdmin: boolean;
  onLogout?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  setActiveTab,
  properties,
  currentProperty,
  onSelectProperty,
  isAdmin,
  onLogout
}) => {
  const currentSession = authService.getSession();
  const currentUser = currentSession.user;

  return (
    <header className="sticky top-0 z-40 bg-[#090a0f]/95 backdrop-blur-xl border-b border-white/10 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#c5a880] to-[#8c6d46] flex items-center justify-center shadow-lg shadow-[#c5a880]/20">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-white tracking-widest">
                  VIBETOUR <span className="text-[#c5a880]">PRO</span>
                </span>
                <span className="text-[9px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 font-bold">
                  {isAdmin ? 'مدیریت فعال' : 'بازدید تور'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-light">
                {isAdmin ? 'سامانه کنترل و پیکربندی مدیر کل' : 'موتور سینمایی بازدید املاک و ویلاهای لوکس'}
              </p>
            </div>
          </div>

          {/* Property Selector Dropdown for Visitors and Admin */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-[#141622] border border-[#c5a880]/40 rounded-xl px-2.5 py-1.5 shadow-md">
              <Building2 className="w-3.5 h-3.5 text-[#c5a880] shrink-0" />
              <select
                value={currentProperty.id}
                onChange={(e) => {
                  const found = properties.find((p) => p.id === e.target.value);
                  if (found) onSelectProperty(found);
                }}
                className="bg-transparent text-xs text-white pr-4 appearance-none focus:outline-none cursor-pointer font-medium max-w-[160px] sm:max-w-[220px] truncate"
                title="انتخاب ملک جهت مشاهده تور"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#141622] text-white">
                    {p.titleFa ? `${p.titleFa} (${p.price})` : `${p.title} (${p.price})`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Center Primary Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-[#12141d] rounded-xl border border-white/10 text-xs w-full md:w-auto overflow-x-auto">
          {/* Always Available for Visitor & Admin */}
          <button
            id="vbt-nav-tab-walkthrough"
            onClick={() => setActiveTab('walkthrough')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium whitespace-nowrap transition-all ${
              activeTab === 'walkthrough'
                ? 'bg-[#c5a880] text-black font-semibold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>مشاهده تور تعاملی (Walkthrough)</span>
          </button>

          {/* ADMIN ONLY TABS: Strictly Hidden from Regular Visitors */}
          {isAdmin && (
            <>
              <button
                id="vbt-nav-tab-admin"
                onClick={() => setActiveTab('admin_dashboard')}
                className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'admin_dashboard'
                    ? 'bg-gradient-to-r from-[#c5a880] to-[#8c6d46] text-black font-bold shadow-md'
                    : 'text-[#e6d5bd] hover:text-white bg-[#c5a880]/10 hover:bg-[#c5a880]/20 border border-[#c5a880]/40'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-[#c5a880]" />
                <span>داشبورد تنظیمات مدیر</span>
              </button>

              <button
                id="vbt-nav-tab-builder"
                onClick={() => setActiveTab('elementor_builder')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'elementor_builder'
                    ? 'bg-[#c5a880] text-black font-semibold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>استودیو المنتور</span>
              </button>

              <button
                id="vbt-nav-tab-video-opt"
                onClick={() => setActiveTab('video_optimizer')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'video_optimizer'
                    ? 'bg-[#c5a880] text-black font-semibold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#c5a880]" />
                <span>بهینه‌ساز ویدیو</span>
              </button>

              <button
                id="vbt-nav-tab-code"
                onClick={() => setActiveTab('plugin_code')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'plugin_code'
                    ? 'bg-[#c5a880] text-black font-semibold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>خروجی کد وردپرس</span>
              </button>

              <button
                id="vbt-nav-tab-roi"
                onClick={() => setActiveTab('broker_roi')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'broker_roi'
                    ? 'bg-[#c5a880] text-black font-semibold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>تحلیل ROI</span>
              </button>
            </>
          )}
        </div>

        {/* Right Status Badge & Admin Login/Logout */}
        <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('admin_dashboard')}
                title="کنترل پنل مدیر فعال است"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[11px]">
                  {currentUser?.email || currentUser?.username || 'مدیر کل'}
                </span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="خروج از حساب مدیر"
                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors"
                >
                  خروج
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('admin_dashboard')}
              title="ورود مدیر با رمز عبور یا جیمیل"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c5a880]/15 hover:bg-[#c5a880]/25 border border-[#c5a880]/40 text-[#e6d5bd] hover:text-white transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-[#c5a880]" />
              <span className="font-medium text-[11px]">ورود مدیریت (Admin Login)</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1 bg-white/5 text-slate-300 border border-white/10 px-2.5 py-1 rounded-lg font-mono text-[10px]">
            <span>4K 60FPS</span>
          </div>
        </div>
      </div>
    </header>
  );
};
