import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Sparkles, 
  Layers, 
  Sliders, 
  ShieldCheck, 
  Zap, 
  Video, 
  Tv, 
  BedDouble, 
  Wine, 
  Sun, 
  Compass, 
  Utensils, 
  Flame, 
  Anchor, 
  Palette,
  Check,
  Copy,
  Gauge,
  FolderOpen,
  Crosshair,
  Image as ImageIcon,
  CheckCircle2,
  Film,
  Upload,
  DoorOpen,
  Lock
} from 'lucide-react';
import { PropertyListing, Room, PluginConfig, Hotspot, MaterialItem } from '../types';
import { MediaLibraryModal, SAMPLE_WP_MEDIA } from './MediaLibraryModal';

interface ElementorBuilderProps {
  property: PropertyListing;
  config: PluginConfig;
  onUpdateProperty: (updated: PropertyListing) => void;
  onUpdateConfig: (updated: PluginConfig) => void;
  onJumpToRoom: (roomId: string) => void;
}

export const ElementorBuilder: React.FC<ElementorBuilderProps> = ({
  property,
  config,
  onUpdateProperty,
  onUpdateConfig,
  onJumpToRoom
}) => {
  const [activeSection, setActiveSection] = useState<'rooms' | 'materials' | 'motion' | 'style' | 'performance'>('rooms');
  const [editingRoomId, setEditingRoomId] = useState<string>(property.rooms[0]?.id || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Media Modal state
  const [mediaModalOpen, setMediaModalOpen] = useState<boolean>(false);
  const [mediaTargetField, setMediaTargetField] = useState<{
    type: 'roomVideo' | 'roomImage' | 'materialSwatch';
    roomId: string;
    materialId?: string;
  } | null>(null);

  // Available room icon options
  const iconOptions = [
    { value: 'Compass', label: 'Compass / Entry (ورودی)', icon: Compass },
    { value: 'Tv', label: 'Salon / Living Hub (پذیرایی)', icon: Tv },
    { value: 'BedDouble', label: 'Suite / Bedroom (مستر)', icon: BedDouble },
    { value: 'Utensils', label: 'Kitchen / Dining (آشپزخانه)', icon: Utensils },
    { value: 'Wine', label: 'Wine / Cellar (نوشیدنی)', icon: Wine },
    { value: 'Sun', label: 'Terrace / Sky Deck (تراس)', icon: Sun },
    { value: 'Flame', label: 'Fireplace / Lounge (شومینه)', icon: Flame },
    { value: 'Anchor', label: 'Dock / Marina (ساحل)', icon: Anchor },
    { value: 'Palette', label: 'Gallery / Art (گالری)', icon: Palette },
  ];

  // Quick video presets
  const videoPresets = [
    { name: '4K Mediterranean Coast Approach', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
    { name: '4K Pivot Portal & Entrance Foyer', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' },
    { name: '4K Grand Living Salon Panorama', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
    { name: '4K Master Royal Suite & Balcony', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
    { name: '4K Minimalist Boffi Kitchen Tour', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4' },
    { name: '4K Sommelier Vault Walkthrough', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4' },
    { name: '4K Sky Infinity Pool & Deck Sunset', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4' },
  ];

  // Recalculate room progress ranges evenly
  const recalculateProgress = (rooms: Room[]): Room[] => {
    const total = rooms.length;
    if (total === 0) return [];
    return rooms.map((r, index) => ({
      ...r,
      startProgress: Number((index / total).toFixed(2)),
      endProgress: Number(((index + 1) / total).toFixed(2))
    }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Add Room
  const handleAddRoom = () => {
    const newRoomNumber = property.rooms.length + 1;
    const newRoom: Room = {
      id: `room-custom-${Date.now()}`,
      name: `Private Suite ${newRoomNumber}`,
      nameFa: `اتاق اختصاصی ${newRoomNumber}`,
      shortName: `0${newRoomNumber}. Suite`,
      shortNameFa: `${newRoomNumber}. اتاق اختصاصی`,
      subtitle: 'Luxury bespoke living space',
      subtitleFa: 'فضای معماری مدرن و اختصاصی',
      icon: 'BedDouble',
      startProgress: 0,
      endProgress: 1,
      totalFrames: 90,
      mediaType: 'mp4',
      mediaUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1920&q=85',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=400&q=80',
      ambientDescription: 'Seamless modern design with floor-to-ceiling glass and smart automated environment controls.',
      ambientDescriptionFa: 'معماری مدرن با شیشه‌های تمام‌قد و سیستم هوشمند یکپارچه.',
      sqft: 1200,
      exposure: 'South / West',
      ceilingHeight: '3.6m',
      hotspots: [
        {
          id: `hs-${Date.now()}`,
          x: 50,
          y: 50,
          frameRange: [10, 70],
          title: 'Custom Italian Joinery',
          titleFa: 'نازک‌کاری چوب گردوی ایتالیایی',
          category: 'Design',
          description: 'Hand-finished walnut millwork with integrated LED reveal detailing.',
          descriptionFa: 'دست‌ساز با چوب گردو و نورپردازی مخفی خطی.'
        }
      ],
      materials: [
        {
          id: `mat-${Date.now()}`,
          name: 'Calacatta Borghini Marble',
          nameFa: 'سنگ مرمر کالاکاتا بورگینی',
          category: 'Stone & Marble',
          origin: 'Carrara, Tuscany, Italy',
          finish: 'Silk Satin Honed',
          description: 'Prestigious white marble with honey gold veining.',
          descriptionFa: 'سنگ مرمر اصیل سفید با رگه‌های طلایی عسلی.',
          swatchUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=300&q=80',
          spec: '20mm Slab',
          x: 45,
          y: 60
        }
      ]
    };

    const updatedRooms = recalculateProgress([...property.rooms, newRoom]);
    onUpdateProperty({ ...property, rooms: updatedRooms });
    setEditingRoomId(newRoom.id);
    onJumpToRoom(newRoom.id);
    showToast(`اتاق جدید «${newRoom.nameFa}» اضافه شد!`);
  };

  // Delete Room
  const handleDeleteRoom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (property.rooms.length <= 1) return;
    const filtered = property.rooms.filter((r) => r.id !== id);
    const updatedRooms = recalculateProgress(filtered);
    onUpdateProperty({ ...property, rooms: updatedRooms });
    if (editingRoomId === id) {
      setEditingRoomId(updatedRooms[0].id);
      onJumpToRoom(updatedRooms[0].id);
    }
    showToast('اتاق حذف گردید.');
  };

  // Move Room Up/Down
  const handleMoveRoom = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const newRooms = [...property.rooms];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRooms.length) return;

    const temp = newRooms[index];
    newRooms[index] = newRooms[targetIndex];
    newRooms[targetIndex] = temp;

    const updatedRooms = recalculateProgress(newRooms);
    onUpdateProperty({ ...property, rooms: updatedRooms });
  };

  // Update specific room property
  const handleUpdateRoomField = (roomId: string, field: keyof Room, value: unknown) => {
    const updatedRooms = property.rooms.map((r) => {
      if (r.id === roomId) {
        return { ...r, [field]: value };
      }
      return r;
    });
    onUpdateProperty({ ...property, rooms: updatedRooms });
    if (field === 'videoUrl') {
      showToast('ویدیوی اتاق با موفقیت به‌روزرسانی شد!');
    }
  };

  // Add Material to editing room
  const handleAddMaterial = (roomId: string) => {
    const newMat: MaterialItem = {
      id: `mat-${Date.now()}`,
      name: 'Custom Architectural Finish',
      nameFa: 'متریال معماری سفارشی',
      category: 'Stone & Cladding',
      origin: 'Milan, Italy',
      finish: 'Matte Honed Satin',
      description: 'Ultra-luxury custom material specification with acoustic dampening.',
      descriptionFa: 'توضیحات اختصاصی متریال، مشخصات مهندسی و بافت لوکس.',
      swatchUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=300&q=80',
      spec: 'ASTM Certified Grade A',
      x: 50,
      y: 50
    };

    const updatedRooms = property.rooms.map((r) => {
      if (r.id === roomId) {
        return { ...r, materials: [...(r.materials || []), newMat] };
      }
      return r;
    });
    onUpdateProperty({ ...property, rooms: updatedRooms });
    showToast(`متریال «${newMat.nameFa}» اضافه شد!`);
  };

  // Delete Material
  const handleDeleteMaterial = (roomId: string, matId: string) => {
    const updatedRooms = property.rooms.map((r) => {
      if (r.id === roomId) {
        return { ...r, materials: (r.materials || []).filter((m) => m.id !== matId) };
      }
      return r;
    });
    onUpdateProperty({ ...property, rooms: updatedRooms });
    showToast('متریال حذف شد.');
  };

  // Handle Media Selected from WordPress Media Library
  const handleMediaSelected = (url: string, assetType: 'video' | 'image') => {
    if (!mediaTargetField) return;
    const { type, roomId, materialId } = mediaTargetField;

    if (type === 'roomVideo') {
      handleUpdateRoomField(roomId, 'videoUrl', url);
    } else if (type === 'roomImage') {
      handleUpdateRoomField(roomId, 'mediaUrl', url);
      handleUpdateRoomField(roomId, 'thumbnailUrl', url);
    } else if (type === 'materialSwatch' && materialId) {
      const room = property.rooms.find((r) => r.id === roomId);
      if (room) {
        const updated = (room.materials || []).map((m) => m.id === materialId ? { ...m, swatchUrl: url } : m);
        handleUpdateRoomField(roomId, 'materials', updated);
      }
    }
  };

  const currentEditingRoom = property.rooms.find((r) => r.id === editingRoomId) || property.rooms[0];

  const copyShortcode = () => {
    const code = `[vibetour_pro id="${property.id}" speed="${config.scrollSpeedFactor}" scrub="${config.scrubSmoothing}" glass="${config.glassBlur}px"]`;
    navigator.clipboard.writeText(code);
    showToast('کد کوتاه وردپرس (Shortcode) کپی شد!');
  };

  return (
    <div className="bg-[#12141d] rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col h-full text-slate-200">
      {/* Media Library Modal */}
      <MediaLibraryModal
        isOpen={mediaModalOpen}
        onClose={() => {
          setMediaModalOpen(false);
          setMediaTargetField(null);
        }}
        onSelect={handleMediaSelected}
        title={mediaTargetField?.type === 'roomVideo' ? 'Select Video Walkthrough / انتخاب ویدیوی اتاق' : 'Select Texture Swatch / انتخاب بافت متریال'}
        filterType={mediaTargetField?.type === 'roomVideo' ? 'video' : 'image'}
      />

      {/* Elementor Panel Top Header */}
      <div className="bg-[#181a24] px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#e2445c] flex items-center justify-center font-bold text-white text-xs shadow">
            E
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-semibold text-white tracking-wider">
                VIBETOUR PRO
              </span>
              <span className="text-[9px] bg-[#c5a880]/20 text-[#c5a880] px-1.5 py-0.5 rounded font-mono font-bold">
                ELEMENTOR WIDGET
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Luxury Video & Material Studio</p>
          </div>
        </div>

        <button
          onClick={copyShortcode}
          className="text-[10px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-white/10 transition-colors"
        >
          <Copy className="w-3 h-3 text-[#c5a880]" />
          <span>کپی شورت‌کد</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-[#c5a880] text-black text-xs font-bold px-4 py-1.5 text-center transition-all animate-in fade-in flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Section Tab Navigation */}
      <div className="grid grid-cols-5 bg-[#0d0f16] border-b border-white/10 text-xs">
        <button
          onClick={() => setActiveSection('rooms')}
          className={`py-2.5 px-1.5 flex items-center justify-center gap-1 font-medium transition-all ${
            activeSection === 'rooms' 
              ? 'text-[#c5a880] border-b-2 border-[#c5a880] bg-[#12141d]' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">اتاق‌ها و ویدیو</span>
        </button>
        <button
          onClick={() => setActiveSection('materials')}
          className={`py-2.5 px-1.5 flex items-center justify-center gap-1 font-medium transition-all ${
            activeSection === 'materials' 
              ? 'text-[#c5a880] border-b-2 border-[#c5a880] bg-[#12141d]' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">متریال‌ها و نقاط</span>
        </button>
        <button
          onClick={() => setActiveSection('motion')}
          className={`py-2.5 px-1.5 flex items-center justify-center gap-1 font-medium transition-all ${
            activeSection === 'motion' 
              ? 'text-[#c5a880] border-b-2 border-[#c5a880] bg-[#12141d]' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">سرعت اسکرول</span>
        </button>
        <button
          onClick={() => setActiveSection('style')}
          className={`py-2.5 px-1.5 flex items-center justify-center gap-1 font-medium transition-all ${
            activeSection === 'style' 
              ? 'text-[#c5a880] border-b-2 border-[#c5a880] bg-[#12141d]' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تم و افکت</span>
        </button>
        <button
          onClick={() => setActiveSection('performance')}
          className={`py-2.5 px-1.5 flex items-center justify-center gap-1 font-medium transition-all ${
            activeSection === 'performance' 
              ? 'text-[#c5a880] border-b-2 border-[#c5a880] bg-[#12141d]' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">کش و سرعت</span>
        </button>
      </div>

      {/* Main Settings Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        
        {/* SECTION 1: ROOMS & VIDEO REPEATER */}
        {activeSection === 'rooms' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-sm font-semibold text-white">
                  اتاق‌ها و ویدیوهای اختصاصی (Chambers & Videos)
                </h4>
                <p className="text-[11px] text-slate-400">
                  ویدیوهای MP4، فریم‌ها و مشخصات هر اتاق را مدیریت کنید.
                </p>
              </div>
              <button
                onClick={handleAddRoom}
                className="px-3.5 py-1.5 rounded-xl bg-[#c5a880] text-black font-bold flex items-center gap-1.5 hover:bg-[#e6d5bd] transition-all shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4 font-bold" />
                <span>افزودن اتاق (Add Room)</span>
              </button>
            </div>

            {/* Room List */}
            <div className="space-y-2">
              {property.rooms.map((room, index) => {
                const isSelected = room.id === editingRoomId;
                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      setEditingRoomId(room.id);
                      onJumpToRoom(room.id);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#1a1e2d] border-[#c5a880] shadow-md'
                        : 'bg-[#161822] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono text-slate-500 font-bold">
                          0{index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-white text-xs">{room.nameFa || room.name}</p>
                            {room.isHub && (
                              <span className="text-[9px] bg-[#c5a880]/20 text-[#c5a880] px-1.5 py-0.5 rounded font-mono font-bold">
                                HUB پذیرایی
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5">
                            {room.videoUrl ? '🎬 ویدیوی اختصاصی فعال' : '🖼️ فریم‌های کانواس'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={index === 0}
                          onClick={(e) => handleMoveRoom(index, 'up', e)}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          title="Move Up"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={index === property.rooms.length - 1}
                          onClick={(e) => handleMoveRoom(index, 'down', e)}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          title="Move Down"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={property.rooms.length <= 1}
                          onClick={(e) => handleDeleteRoom(room.id, e)}
                          className="p-1 text-red-400 hover:text-red-300 disabled:opacity-30 ml-1"
                          title="Delete Room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Room Details */}
            {currentEditingRoom && (
              <div className="mt-5 p-4 rounded-2xl bg-[#161822] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-display font-semibold text-[#c5a880] text-xs">
                    ویرایش: {currentEditingRoom.nameFa || currentEditingRoom.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{currentEditingRoom.id}</span>
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      عنوان اتاق (فارسی)
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={currentEditingRoom.nameFa || ''}
                      onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'nameFa', e.target.value)}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:border-[#c5a880] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Room Title (English)
                    </label>
                    <input
                      type="text"
                      value={currentEditingRoom.name}
                      onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'name', e.target.value)}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:border-[#c5a880] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Subtitles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      توضیح کوتاه (فارسی)
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={currentEditingRoom.subtitleFa || ''}
                      onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'subtitleFa', e.target.value)}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:border-[#c5a880] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Short Subtitle (English)
                    </label>
                    <input
                      type="text"
                      value={currentEditingRoom.subtitle}
                      onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'subtitle', e.target.value)}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:border-[#c5a880] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Video URL & WP Media Library Picker */}
                <div className="space-y-2 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#c5a880] flex items-center gap-1.5">
                      <Video className="w-4 h-4" />
                      <span>لینک ویدیوی اختصاصی این اتاق (Video Walkthrough URL)</span>
                    </label>
                    
                    <div className="flex items-center gap-1.5">
                      <label className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow">
                        <Upload className="w-3 h-3" />
                        <span>فایل از سیستم</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const blobUrl = URL.createObjectURL(file);
                              handleUpdateRoomField(currentEditingRoom.id, 'videoUrl', blobUrl);
                            }
                          }}
                        />
                      </label>

                      <button
                        onClick={() => {
                          setMediaTargetField({ type: 'roomVideo', roomId: currentEditingRoom.id });
                          setMediaModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#2271b1] hover:bg-[#135e96] text-white text-[10px] font-semibold flex items-center gap-1 transition-colors shadow"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>رسانه وردپرس</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={currentEditingRoom.videoUrl || ''}
                    placeholder="https://your-domain.com/wp-content/uploads/room-video.mp4"
                    onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'videoUrl', e.target.value)}
                    className="w-full bg-[#0d0f16] border border-[#c5a880]/50 rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:border-[#c5a880] focus:outline-none"
                  />

                  {/* Preset Video Quick Selector */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-400">پریست‌های آماده ویدیو:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleUpdateRoomField(currentEditingRoom.id, 'videoUrl', e.target.value);
                        }
                      }}
                      className="flex-1 bg-[#0d0f16] border border-white/10 rounded-lg px-2.5 py-1 text-slate-300 text-[10px] focus:outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>انتخاب نمونه ویدیوی باکیفیت 4K...</option>
                      {videoPresets.map((vp, i) => (
                        <option key={i} value={vp.url}>{vp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fallback Image / Poster */}
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-[#c5a880]" />
                      <span>تصویر پس‌زمینه / فریم بوم (Image / Frame URL)</span>
                    </label>
                    <button
                      onClick={() => {
                        setMediaTargetField({ type: 'roomImage', roomId: currentEditingRoom.id });
                        setMediaModalOpen(true);
                      }}
                      className="text-[10px] text-[#c5a880] hover:underline"
                    >
                      انتخاب از رسانه
                    </button>
                  </div>
                  <input
                    type="text"
                    value={currentEditingRoom.mediaUrl}
                    onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'mediaUrl', e.target.value)}
                    className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-1.5 text-white font-mono text-[10px] focus:border-[#c5a880] focus:outline-none"
                  />
                </div>

                {/* Pause Gate & Room Entrance Checkpoint (توقف خودکار اسکرول و منوی ورود به اتاق‌ها) */}
                <div className="p-3 bg-[#131622] rounded-xl border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DoorOpen className="w-3.5 h-3.5 text-[#c5a880]" />
                      <span className="text-xs font-bold text-white">
                        توقف خودکار اسکرول و منوی ورود به اتاق‌ها (Pause Gate)
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentEditingRoom.enablePauseGate ?? false}
                        onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'enablePauseGate', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#c5a880]"></div>
                    </label>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    هنگام اسکرول کاربر، ویدیو در نقطه مشخص شده متوقف و قفل می‌شود و منوی شیک ورود به سایر اتاق‌ها نمایش داده خواهد شد و اجازه عبور اسکرول داده نمی‌شود.
                  </p>

                  {currentEditingRoom.enablePauseGate && (
                    <div className="space-y-2.5 pt-2 border-t border-white/10 animate-in fade-in">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300">درصد وقوع توقف روی این ویدیو:</span>
                        <span className="font-mono text-[#c5a880] font-bold">
                          {Math.round((currentEditingRoom.pauseCheckpointProgress ?? 0.85) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.95"
                        step="0.05"
                        value={currentEditingRoom.pauseCheckpointProgress ?? 0.85}
                        onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'pauseCheckpointProgress', parseFloat(e.target.value))}
                        className="w-full accent-[#c5a880] cursor-pointer h-1.5"
                      />

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">عنوان پیام در لحظه توقف:</label>
                        <input
                          type="text"
                          value={currentEditingRoom.pauseGateTitleFa || ''}
                          placeholder="به تقاطع فضاهای عمارت رسیدید؛ انتخاب مقصد بعدی:"
                          onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'pauseGateTitleFa', e.target.value)}
                          className="w-full bg-[#0d0f16] border border-white/10 rounded-lg px-2.5 py-1 text-white text-[10px] focus:outline-none focus:border-[#c5a880]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Options & Hub Setting */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/10">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      آیکون ناوبری (Icon)
                    </label>
                    <select
                      value={currentEditingRoom.icon}
                      onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'icon', e.target.value)}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:border-[#c5a880] focus:outline-none"
                    >
                      {iconOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      مرکز پذیرایی اصلی (Grand Salon Hub)
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={!!currentEditingRoom.isHub}
                        onChange={(e) => handleUpdateRoomField(currentEditingRoom.id, 'isHub', e.target.checked)}
                        className="w-4 h-4 accent-[#c5a880] rounded cursor-pointer"
                      />
                      <span className="text-xs text-slate-300">توقف در این فضا و نمایش منو</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: MATERIALS & FINISHES BUILDER WITH INTERACTIVE PIN PLACEMENT */}
        {activeSection === 'materials' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-sm font-semibold text-white">
                  متریال‌ها و نقاط تعاملی روی بوم (Materials & Interactive Pins)
                </h4>
                <p className="text-[11px] text-slate-400">
                  متریال‌های لوکس برای فضای «{currentEditingRoom?.nameFa || currentEditingRoom?.name}» را با نقطه روی تصویر تنظیم کنید.
                </p>
              </div>
              <button
                onClick={() => handleAddMaterial(currentEditingRoom.id)}
                className="px-3.5 py-1.5 rounded-xl bg-[#c5a880] text-black font-bold flex items-center gap-1.5 hover:bg-[#e6d5bd] transition-all shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4 font-bold" />
                <span>افزودن متریال جدید (Add Material)</span>
              </button>
            </div>

            {/* Material List */}
            <div className="space-y-3">
              {(currentEditingRoom.materials || []).map((mat) => (
                <div key={mat.id} className="p-4 bg-[#161822] rounded-2xl border border-white/10 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <img 
                        src={mat.swatchUrl} 
                        alt={mat.name} 
                        className="w-9 h-9 rounded-xl object-cover border border-[#c5a880]/40 shadow"
                      />
                      <div>
                        <h5 className="font-bold text-white text-xs">{mat.nameFa || mat.name}</h5>
                        <p className="text-[10px] text-[#c5a880]">{mat.category} • {mat.origin}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMaterial(currentEditingRoom.id, mat.id)}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg transition-colors"
                      title="Delete Material"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">نام فارسی متریال</label>
                      <input 
                        type="text" 
                        dir="rtl"
                        value={mat.nameFa || ''} 
                        onChange={(e) => {
                          const updated = (currentEditingRoom.materials || []).map((m) => m.id === mat.id ? { ...m, nameFa: e.target.value } : m);
                          handleUpdateRoomField(currentEditingRoom.id, 'materials', updated);
                        }}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-[#c5a880] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Material Name (English)</label>
                      <input 
                        type="text" 
                        value={mat.name} 
                        onChange={(e) => {
                          const updated = (currentEditingRoom.materials || []).map((m) => m.id === mat.id ? { ...m, name: e.target.value } : m);
                          handleUpdateRoomField(currentEditingRoom.id, 'materials', updated);
                        }}
                        className="w-full bg-[#0d0f16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-[#c5a880] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">توضیحات و مشخصات متریال (فارسی)</label>
                    <textarea
                      dir="rtl"
                      rows={2}
                      value={mat.descriptionFa || ''}
                      onChange={(e) => {
                        const updated = (currentEditingRoom.materials || []).map((m) => m.id === mat.id ? { ...m, descriptionFa: e.target.value } : m);
                        handleUpdateRoomField(currentEditingRoom.id, 'materials', updated);
                      }}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-[#c5a880] focus:outline-none text-xs"
                    />
                  </div>

                  {/* Interactive Pin Position X / Y on Canvas */}
                  <div className="bg-[#0d0f16] p-3 rounded-xl border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#c5a880] flex items-center gap-1.5">
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>موقعیت نقطه روی تصویر (Pin X / Y Position):</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-300">
                        X: {mat.x ?? 50}% • Y: {mat.y ?? 50}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>موقعیت افقی (X)</span>
                          <span>{mat.x ?? 50}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="95"
                          value={mat.x ?? 50}
                          onChange={(e) => {
                            const updated = (currentEditingRoom.materials || []).map((m) => m.id === mat.id ? { ...m, x: parseInt(e.target.value) } : m);
                            handleUpdateRoomField(currentEditingRoom.id, 'materials', updated);
                          }}
                          className="w-full accent-[#c5a880] cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>موقعیت عمودی (Y)</span>
                          <span>{mat.y ?? 50}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          value={mat.y ?? 50}
                          onChange={(e) => {
                            const updated = (currentEditingRoom.materials || []).map((m) => m.id === mat.id ? { ...m, y: parseInt(e.target.value) } : m);
                            handleUpdateRoomField(currentEditingRoom.id, 'materials', updated);
                          }}
                          className="w-full accent-[#c5a880] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Swatch URL & WP Media Picker */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400">آدرس تصویر بافت (Texture Swatch URL)</label>
                      <button
                        onClick={() => {
                          setMediaTargetField({ type: 'materialSwatch', roomId: currentEditingRoom.id, materialId: mat.id });
                          setMediaModalOpen(true);
                        }}
                        className="text-[10px] text-[#c5a880] hover:underline"
                      >
                        انتخاب از رسانه وردپرس
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={mat.swatchUrl} 
                      onChange={(e) => {
                        const updated = (currentEditingRoom.materials || []).map((m) => m.id === mat.id ? { ...m, swatchUrl: e.target.value } : m);
                        handleUpdateRoomField(currentEditingRoom.id, 'materials', updated);
                      }}
                      className="w-full bg-[#0d0f16] border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono text-[10px] focus:border-[#c5a880] focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: SCROLL SPEED & KINETIC MOTION */}
        {activeSection === 'motion' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-display text-sm font-semibold text-white">
                سرعت اسکرول و حس سینمایی (Cinematic Scroll Velocity)
              </h4>
              <p className="text-[11px] text-slate-400">
                سرعت اسکرول را کاهش دهید تا کاربر با آرامش و شکوه در فضا حرکت کند.
              </p>
            </div>

            {/* Slower Scroll Factor */}
            <div className="p-4 bg-[#161822] rounded-2xl border border-white/10 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white">
                  ضریب سرعت اسکرول (سرعت کمتر = جلوه لوکس‌تر)
                </label>
                <span className="font-mono text-xs font-bold text-[#c5a880]">
                  {((config.scrollSpeedFactor || 0.45) * 100).toFixed(0)}% Speed
                </span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { label: '۰.۲۵x آرام', val: 0.25 },
                  { label: '۰.۴۵x سینما', val: 0.45 },
                  { label: '۰.۸x متعادل', val: 0.8 },
                  { label: '۱.۲x سریع', val: 1.2 },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, scrollSpeedFactor: p.val })}
                    className={`py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      Math.abs((config.scrollSpeedFactor || 0.45) - p.val) < 0.05
                        ? 'bg-[#c5a880] text-black shadow'
                        : 'bg-white/5 hover:bg-white/15 text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="0.15"
                max="2.0"
                step="0.05"
                value={config.scrollSpeedFactor || 0.45}
                onChange={(e) => onUpdateConfig({ ...config, scrollSpeedFactor: parseFloat(e.target.value) })}
                className="w-full accent-[#c5a880] cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                میزان ۳۵٪ الی ۴۵٪ بهترین توازن را برای تورهای املاک لوکس ایجاد می‌کند.
              </p>
            </div>

            {/* Global Checkpoint Gates Toggle */}
            <div className="p-4 bg-[#161822] rounded-2xl border border-white/10 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-[#c5a880]" />
                  <label className="text-xs font-semibold text-white">
                    فعال‌سازی ایستگاه‌های توقف خودکار برای تمام اتاق‌ها
                  </label>
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
              <p className="text-[10px] text-slate-400 leading-relaxed">
                در صورت فعال بودن، هر فضایی که قابلیت Pause Gate روی آن روشن باشد در فریم تعیین شده اسکرول را متوقف کرده و منوی تصمیم‌گیری را تا زمان تعیین مقصد یا کلیک ادامه قفل نگه می‌دارد.
              </p>
            </div>

            {/* GSAP Smoothing Inertia */}
            <div className="p-4 bg-[#161822] rounded-2xl border border-white/10 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white">
                  نرمی و لختی حرکت (Inertia Smoothing)
                </label>
                <span className="font-mono text-xs font-bold text-[#c5a880]">
                  {config.scrubSmoothing.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="3.0"
                step="0.1"
                value={config.scrubSmoothing}
                onChange={(e) => onUpdateConfig({ ...config, scrubSmoothing: parseFloat(e.target.value) })}
                className="w-full accent-[#c5a880] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* SECTION 4: GLASS UI */}
        {activeSection === 'style' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-display text-sm font-semibold text-white">
                طراحی گلس‌مورفیک و افکت‌های بصری
              </h4>
              <p className="text-[11px] text-slate-400">
                تنظیم میزان تاری شیشه، تم رنگی شامپاینی و شفافیت المان‌ها.
              </p>
            </div>

            <div className="p-4 bg-[#161822] rounded-2xl border border-white/10 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white">
                  میزان تاری پس‌زمینه گلس (Glass Blur)
                </label>
                <span className="font-mono text-xs font-bold text-[#c5a880]">
                  {config.glassBlur}px
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="30"
                step="1"
                value={config.glassBlur}
                onChange={(e) => onUpdateConfig({ ...config, glassBlur: parseInt(e.target.value) })}
                className="w-full accent-[#c5a880] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* SECTION 5: PERFORMANCE */}
        {activeSection === 'performance' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-display text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>سازگاری ۱۰۰٪ با LiteSpeed و WP Rocket</span>
              </h4>
            </div>

            <div className="p-4 bg-[#161822] rounded-2xl border border-white/10 space-y-2 text-xs">
              <p className="text-slate-300">
                • ایزولاسیون کامل نام‌گذاری و پیشوند CSS با <code>vbt-t-</code>.
              </p>
              <p className="text-slate-300">
                • رندر مستقیم در HTML5 Canvas بدون ایجاد سربار روی DOM.
              </p>
              <p className="text-slate-300">
                • بارگذاری هوشمند ویدیوها بدون مسدودسازی رندر اولیه صفحه.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="bg-[#181a24] px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          هماهنگ‌سازی زنده با بوم تور فعال است
        </span>
        <button
          onClick={copyShortcode}
          className="px-4 py-1.5 rounded-xl bg-[#c5a880] text-black font-bold hover:bg-[#e6d5bd] transition-all shadow-md active:scale-95"
        >
          درج در صفحه
        </button>
      </div>
    </div>
  );
};
