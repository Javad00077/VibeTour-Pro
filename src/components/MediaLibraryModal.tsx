import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Video, 
  Image as ImageIcon, 
  Check, 
  Film, 
  Search,
  Sparkles,
  Link2
} from 'lucide-react';

export interface MediaAsset {
  id: string;
  title: string;
  type: 'video' | 'image';
  url: string;
  thumbnail: string;
  duration?: string;
  resolution: string;
  fileSize: string;
}

export const SAMPLE_WP_MEDIA: MediaAsset[] = [
  {
    id: 'wp-vid-1',
    title: 'Monaco Harbor Approach & Helipad (MP4 4K)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
    duration: '0:15',
    resolution: '3840x2160 (4K)',
    fileSize: '14.2 MB'
  },
  {
    id: 'wp-vid-2',
    title: 'Biometric Pivot Door & Foyer Entrance (MP4 4K)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
    duration: '0:15',
    resolution: '3840x2160 (4K)',
    fileSize: '16.8 MB'
  },
  {
    id: 'wp-vid-3',
    title: 'Grand Living Salon & Terrace Pan (MP4 4K)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=400&q=80',
    duration: '0:18',
    resolution: '1920x1080 (FHD)',
    fileSize: '12.5 MB'
  },
  {
    id: 'wp-vid-4',
    title: 'Master Royal Suite & Dressing (MP4 4K)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=400&q=80',
    duration: '0:20',
    resolution: '1920x1080 (FHD)',
    fileSize: '18.1 MB'
  },
  {
    id: 'wp-vid-5',
    title: 'Minimalist Boffi Kitchen & Island (MP4 4K)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=400&q=80',
    duration: '0:16',
    resolution: '1920x1080 (FHD)',
    fileSize: '15.4 MB'
  },
  {
    id: 'wp-vid-6',
    title: 'Sommelier Wine Vault & Vault Doors (MP4 4K)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=400&q=80',
    duration: '0:15',
    resolution: '1920x1080 (FHD)',
    fileSize: '11.8 MB'
  },
  {
    id: 'wp-vid-7',
    title: 'Sunset Deck & Infinity Pool Walkthrough (MP4 4K)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80',
    duration: '0:22',
    resolution: '1920x1080 (FHD)',
    fileSize: '19.2 MB'
  },
  {
    id: 'wp-img-1',
    title: 'Calacatta Marble Island Macro Texture (JPG 4K)',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1920&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=400&q=80',
    resolution: '3840x2560',
    fileSize: '3.4 MB'
  },
  {
    id: 'wp-img-2',
    title: 'French Oak Smoked Parquet Finish (JPG 4K)',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=1920&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=400&q=80',
    resolution: '3840x2560',
    fileSize: '2.9 MB'
  },
  {
    id: 'wp-img-3',
    title: 'Titanium PVD Brushed Gold Swatch (JPG 4K)',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986b88?auto=format&fit=crop&w=1920&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1533090161767-e6ffed986b88?auto=format&fit=crop&w=400&q=80',
    resolution: '3840x2560',
    fileSize: '2.1 MB'
  }
];

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (url: string, assetType: 'video' | 'image') => void;
  onSelectMedia?: (url: string, assetType?: 'video' | 'image') => void;
  title?: string;
  filterType?: 'all' | 'video' | 'image';
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onSelectMedia,
  title = 'WordPress Media Library / کتابخانه رسانه وردپرس',
  filterType = 'all'
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'video' | 'image'>(filterType);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [customUrl, setCustomUrl] = useState('');

  if (!isOpen) return null;

  const filteredAssets = SAMPLE_WP_MEDIA.filter((asset) => {
    const matchesFilter = activeFilter === 'all' || asset.type === activeFilter;
    const matchesSearch = asset.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleConfirm = () => {
    const callback = onSelect || onSelectMedia;
    if (customUrl.trim()) {
      const isVid = customUrl.endsWith('.mp4') || customUrl.endsWith('.webm') || customUrl.includes('video');
      if (typeof callback === 'function') {
        callback(customUrl.trim(), isVid ? 'video' : 'image');
      }
      onClose();
    } else if (selectedAsset) {
      if (typeof callback === 'function') {
        callback(selectedAsset.url, selectedAsset.type);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#12141d] border border-white/15 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="bg-[#181a24] px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2271b1] flex items-center justify-center text-white font-bold text-sm shadow">
              W
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-bold text-white tracking-wide">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400">
                Select high-resolution video streams or texture swatches for your listing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-[#0e1017] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === 'all'
                  ? 'bg-[#c5a880] text-black font-semibold'
                  : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              All Media ({SAMPLE_WP_MEDIA.length})
            </button>
            <button
              onClick={() => setActiveFilter('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeFilter === 'video'
                  ? 'bg-[#c5a880] text-black font-semibold'
                  : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Videos (MP4)</span>
            </button>
            <button
              onClick={() => setActiveFilter('image')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeFilter === 'image'
                  ? 'bg-[#c5a880] text-black font-semibold'
                  : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Textures & Swatches</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search media files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161824] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#c5a880]"
            />
          </div>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => {
            const isSelected = selectedAsset?.id === asset.id;
            return (
              <div
                key={asset.id}
                onClick={() => {
                  setSelectedAsset(asset);
                  setCustomUrl(asset.url);
                }}
                className={`group relative p-2.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between overflow-hidden shadow-lg ${
                  isSelected
                    ? 'bg-[#1a1e2d] border-[#c5a880] ring-2 ring-[#c5a880]/50'
                    : 'bg-[#161824]/80 border-white/5 hover:border-white/20 hover:bg-[#1a1d2e]'
                }`}
              >
                <div className="relative h-32 rounded-xl overflow-hidden bg-black/40 border border-white/10">
                  <img
                    src={asset.thumbnail}
                    alt={asset.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-[#c5a880]">
                    {asset.type === 'video' ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    <span>{asset.type.toUpperCase()}</span>
                  </div>

                  {asset.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">
                      {asset.duration}
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute inset-0 bg-[#c5a880]/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-[#c5a880] text-black flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5 font-bold" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 space-y-1">
                  <h4 className="font-semibold text-white text-xs truncate">
                    {asset.title}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{asset.resolution}</span>
                    <span>{asset.fileSize}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom URL Input & Footer */}
        <div className="bg-[#181a24] p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="w-full sm:flex-1 relative">
            <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Or paste direct MP4 / WebM / Image URL here..."
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value);
                setSelectedAsset(null);
              }}
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-[#c5a880]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!customUrl.trim() && !selectedAsset}
              className="px-5 py-2 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-bold flex items-center gap-1.5 transition-all shadow-lg disabled:opacity-40"
            >
              <Check className="w-4 h-4 font-bold" />
              <span>Use Selected Media</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
