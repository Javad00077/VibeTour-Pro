/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Bed, 
  Bath, 
  Maximize2, 
  MapPin, 
  Calendar, 
  Phone, 
  Mail, 
  Sparkles, 
  Award, 
  ExternalLink,
  Sliders,
  FolderArchive,
  Compass,
  CheckCircle,
  Share2
} from 'lucide-react';
import { LUXURY_PROPERTIES, DEFAULT_CONFIG } from './data/properties';
import { PropertyListing, PluginConfig, ActiveTab } from './types';
import { CanvasWalkthrough } from './components/CanvasWalkthrough';
import { ElementorBuilder } from './components/ElementorBuilder';
import { WordPressPluginExporter } from './components/WordPressPluginExporter';
import { StatusConversionROI } from './components/StatusConversionROI';
import { VideoOptimizerGuide } from './components/VideoOptimizerGuide';
import { HeaderNav } from './components/HeaderNav';
import { AdminDashboard } from './components/AdminDashboard';
import { authService } from './utils/authService';

const STORAGE_PROPERTIES_KEY = 'vbt_persisted_properties_v1';
const STORAGE_CONFIG_KEY = 'vbt_persisted_config_v1';

export default function App() {
  const [properties, setProperties] = useState<PropertyListing[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROPERTIES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return LUXURY_PROPERTIES;
  });

  const [currentProperty, setCurrentProperty] = useState<PropertyListing>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROPERTIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch {}
    return LUXURY_PROPERTIES[0];
  });

  const [config, setConfig] = useState<PluginConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('walkthrough');
  const [activeRoomId, setActiveRoomId] = useState<string>(LUXURY_PROPERTIES[0].rooms[0].id);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // Authentication State for Admin-only access enforcement
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return authService.getSession().isAuthenticated;
  });

  // Sync auth state across sessions
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAdmin(authService.getSession().isAuthenticated);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Guard restricted tabs for non-admin visitors
  useEffect(() => {
    const adminOnlyTabs: ActiveTab[] = ['elementor_builder', 'video_optimizer', 'plugin_code', 'broker_roi'];
    if (!isAdmin && adminOnlyTabs.includes(activeTab)) {
      setActiveTab('walkthrough');
    }
  }, [isAdmin, activeTab]);

  // Update property state when edited in Elementor Builder or Admin Dashboard
  const handleUpdateProperty = (updated: PropertyListing) => {
    setCurrentProperty(updated);
    setProperties((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      try {
        localStorage.setItem(STORAGE_PROPERTIES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Add new property profile (Admin only)
  const handleAddProperty = (newProp: PropertyListing) => {
    setProperties((prev) => {
      const next = [newProp, ...prev];
      try {
        localStorage.setItem(STORAGE_PROPERTIES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setCurrentProperty(newProp);
    if (newProp.rooms.length > 0) {
      setActiveRoomId(newProp.rooms[0].id);
    }
  };

  // Delete property profile (Admin only)
  const handleDeleteProperty = (id: string) => {
    setProperties((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem(STORAGE_PROPERTIES_KEY, JSON.stringify(next));
      } catch {}
      if (currentProperty.id === id && next.length > 0) {
        setCurrentProperty(next[0]);
        setActiveRoomId(next[0].rooms[0].id);
      }
      return next;
    });
  };

  const handleUpdateConfig = (newCfg: PluginConfig) => {
    setConfig(newCfg);
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(newCfg));
    } catch {}
  };

  const handleLogout = () => {
    authService.logout();
    setIsAdmin(false);
    setActiveTab('walkthrough');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col font-sans selection:bg-[#c5a880] selection:text-black">
      {/* Top Header & Mode Navigation */}
      <HeaderNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        properties={properties}
        currentProperty={currentProperty}
        onSelectProperty={(p) => {
          setCurrentProperty(p);
          setActiveRoomId(p.rooms[0].id);
        }}
        isAdmin={isAdmin}
        onLogout={handleLogout}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* TAB 1: LIVE INTERACTIVE WALKTHROUGH EXPERIENCE */}
        {activeTab === 'walkthrough' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* The Flagship Canvas Walkthrough Viewport */}
            <CanvasWalkthrough
              property={currentProperty}
              config={config}
              activeRoomId={activeRoomId}
              onSelectRoom={(roomId) => setActiveRoomId(roomId)}
              onOpenCustomizer={isAdmin ? () => setActiveTab('elementor_builder') : undefined}
              isAdmin={isAdmin}
            />

            {/* Property Key Details & Broker Contact Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Architectural Highlights & Specs */}
              <div className="lg:col-span-2 vbt-glass p-6 rounded-2xl space-y-4 border border-white/10 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#c5a880]">
                      {currentProperty.tagline}
                    </span>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-0.5">
                      {currentProperty.title}
                    </h2>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#c5a880]" />
                      <span>{currentProperty.location}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="font-display text-2xl font-bold text-[#c5a880]">
                      {currentProperty.price}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      MLS #{currentProperty.mlsNumber}
                    </p>
                  </div>
                </div>

                {/* Key Spec Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-[#141622] p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-slate-400 block">Bedrooms</span>
                    <span className="font-display text-base font-bold text-white">{currentProperty.beds} Suites</span>
                  </div>
                  <div className="bg-[#141622] p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-slate-400 block">Bathrooms</span>
                    <span className="font-display text-base font-bold text-white">{currentProperty.baths} Baths</span>
                  </div>
                  <div className="bg-[#141622] p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-slate-400 block">Interior Living</span>
                    <span className="font-display text-base font-bold text-white">{currentProperty.sqft.toLocaleString()} sq ft</span>
                  </div>
                  <div className="bg-[#141622] p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-slate-400 block">Architecture</span>
                    <span className="font-display text-xs font-semibold text-[#c5a880] truncate block mt-1">{currentProperty.architect}</span>
                  </div>
                </div>

                {/* Chamber Quick Jump Matrix */}
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-300 block mb-2.5">
                    Interactive Walkthrough Sequences ({currentProperty.rooms.length} Chambers)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentProperty.rooms.map((room, idx) => (
                      <div
                        key={room.id}
                        onClick={() => setActiveRoomId(room.id)}
                        className="p-3 rounded-xl bg-[#141622]/80 hover:bg-[#1b1e2e] border border-white/5 hover:border-[#c5a880]/40 transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[#c5a880]">0{idx + 1}</span>
                            <span className="text-xs font-medium text-white">{room.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{room.subtitle}</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {room.totalFrames} frames
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 1 Col: Listing Broker Contact Card */}
              <div className="vbt-glass-gold p-6 rounded-2xl space-y-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#c5a880] uppercase tracking-widest font-mono">
                    <Award className="w-4 h-4" />
                    <span>Exclusive Listing Agent</span>
                  </div>

                  <div className="flex items-center gap-3.5 mt-4">
                    <img
                      src={currentProperty.broker.avatar}
                      alt={currentProperty.broker.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#c5a880]/60 shadow-md"
                    />
                    <div>
                      <h4 className="font-display text-base font-bold text-white">
                        {currentProperty.broker.name}
                      </h4>
                      <p className="text-xs text-slate-300 font-light">
                        {currentProperty.broker.title}
                      </p>
                      <p className="text-[11px] text-[#c5a880] mt-0.5">
                        {currentProperty.broker.agency}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-5 text-xs text-slate-300">
                    <a
                      href={`tel:${currentProperty.broker.phone}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 transition-colors"
                    >
                      <Phone className="w-4 h-4 text-[#c5a880]" />
                      <span>{currentProperty.broker.phone}</span>
                    </a>
                    <a
                      href={`mailto:${currentProperty.broker.email}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-[#c5a880]" />
                      <span className="truncate">{currentProperty.broker.email}</span>
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-2">
                  <button
                    onClick={handleShare}
                    className="w-full py-2.5 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#c5a880]/20"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{shareCopied ? 'Tour Link Copied!' : 'Share Walkthrough Tour'}</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => setActiveTab('plugin_code')}
                      className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                    >
                      <FolderArchive className="w-3.5 h-3.5 text-[#c5a880]" />
                      <span>Download WordPress Plugin (.zip)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE ELEMENTOR VISUAL BUILDER (SPLIT SCREEN WORKSPACE - ADMIN ONLY) */}
        {isAdmin && activeTab === 'elementor_builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300 items-start">
            {/* Left 5 Cols: Elementor Panel */}
            <div className="lg:col-span-5 h-[800px]">
              <ElementorBuilder
                property={currentProperty}
                config={config}
                onUpdateProperty={handleUpdateProperty}
                onUpdateConfig={setConfig}
                onJumpToRoom={(roomId) => setActiveRoomId(roomId)}
              />
            </div>

            {/* Right 7 Cols: Live Synced Canvas Viewport */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Elementor Canvas Render Sync
                </span>
                <span className="text-[10px] text-[#c5a880]">Changes reflected in real-time</span>
              </div>
              <CanvasWalkthrough
                property={currentProperty}
                config={config}
                activeRoomId={activeRoomId}
                onSelectRoom={(roomId) => setActiveRoomId(roomId)}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        )}

        {/* TAB 3: VIDEO OPTIMIZER, DIAGNOSTICS & TESTING STUDIO (ADMIN ONLY) */}
        {isAdmin && activeTab === 'video_optimizer' && (
          <div className="h-[800px] animate-in fade-in duration-300">
            <VideoOptimizerGuide 
              onApplyVideoToRoom={(videoUrl) => {
                const updatedRooms = currentProperty.rooms.map((room) => 
                  room.id === activeRoomId ? { ...room, videoUrl } : room
                );
                handleUpdateProperty({
                  ...currentProperty,
                  rooms: updatedRooms
                });
                setActiveTab('walkthrough');
              }}
            />
          </div>
        )}

        {/* TAB 4: WORDPRESS PLUGIN EXPORTER & CODE VIEWER (ADMIN ONLY) */}
        {isAdmin && activeTab === 'plugin_code' && (
          <div className="h-[800px] animate-in fade-in duration-300">
            <WordPressPluginExporter
              property={currentProperty}
              config={config}
            />
          </div>
        )}

        {/* TAB 5: STATUS CONVERSION ENGINE & BROKER ROI (ADMIN ONLY) */}
        {isAdmin && activeTab === 'broker_roi' && (
          <div className="animate-in fade-in duration-300">
            <StatusConversionROI />
          </div>
        )}

        {/* TAB 6: AUTHENTICATED ADMIN DASHBOARD (تنظیمات نما، ویدیوها، سرعت و مدیریت رمز/جیمیل) */}
        {activeTab === 'admin_dashboard' && (
          <div className="animate-in fade-in duration-300">
            <AdminDashboard
              properties={properties}
              currentProperty={currentProperty}
              config={config}
              onUpdateProperty={handleUpdateProperty}
              onSelectProperty={(p) => {
                setCurrentProperty(p);
                setActiveRoomId(p.rooms[0].id);
              }}
              onAddProperty={handleAddProperty}
              onDeleteProperty={handleDeleteProperty}
              onUpdateConfig={handleUpdateConfig}
              onNavigateToWalkthrough={() => setActiveTab('walkthrough')}
              onSelectTab={(tab) => setActiveTab(tab)}
              onAuthChange={(authenticated) => setIsAdmin(authenticated)}
            />
          </div>
        )}

      </main>

      {/* Luxury Footer */}
      <footer className="mt-12 border-t border-white/10 bg-[#07080c] py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-slate-300 tracking-wider">
              VIBETOUR PRO
            </span>
            <span>—</span>
            <span>The Premier Luxury Real Estate Walkthrough Plugin for WordPress & Elementor</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>GSAP 3.12.5 Powered</span>
            <span>•</span>
            <span>HTML5 Canvas Pipeline</span>
            <span>•</span>
            <span>LiteSpeed Cache Immune</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
