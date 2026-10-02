export interface Hotspot {
  id: string;
  x: number; // 0 to 100 percentage of canvas width
  y: number; // 0 to 100 percentage of canvas height
  frameRange: [number, number]; // Visible frame window (e.g., [20, 60])
  title: string;
  titleFa?: string;
  category: 'Architectural' | 'Material' | 'Technology' | 'Design';
  description: string;
  descriptionFa?: string;
  spec?: string;
  priceTag?: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  nameFa?: string;
  category: string; // e.g. 'Stone & Marble', 'Wood & Joinery', 'Glass & Metal', 'Fabrics & Leather'
  origin: string; // e.g. 'Carrara, Italy', 'Bordeaux, France'
  finish: string; // e.g. 'Honed Matte', 'Polished Silk', 'Brushed Brass PVD'
  description: string;
  descriptionFa?: string;
  swatchUrl: string; // Texture / Material swatch preview
  spec?: string;
  ecoCert?: string;
  x?: number; // Pin coordinate X percentage (0-100) on room canvas
  y?: number; // Pin coordinate Y percentage (0-100) on room canvas
}

export interface Room {
  id: string;
  name: string;
  nameFa?: string;
  shortName: string;
  shortNameFa?: string;
  subtitle: string;
  subtitleFa?: string;
  icon: string; // Lucide icon identifier
  startProgress: number; // 0.0 to 1.0
  endProgress: number;   // 0.0 to 1.0
  totalFrames: number;
  mediaType: 'sequence' | 'mp4' | 'youtube';
  mediaUrl: string;
  videoUrl?: string; // Dedicated high-res video clip for this room
  thumbnailUrl: string;
  ambientDescription: string;
  ambientDescriptionFa?: string;
  sqft?: number;
  exposure?: string;
  ceilingHeight?: string;
  isHub?: boolean; // Central Grand Living Salon Hub where the menu opens
  enablePauseGate?: boolean; // Whether scroll should stop at checkpoint and display Room Decision Portal
  pauseCheckpointProgress?: number; // 0.1 to 0.95 (e.g. 0.85 = stop at 85% of this room)
  pauseGateTitleFa?: string;
  pauseGateTitle?: string;
  hotspots: Hotspot[];
  materials?: MaterialItem[];
}

export interface PropertyListing {
  id: string;
  title: string;
  titleFa?: string;
  subtitle: string;
  subtitleFa?: string;
  tagline: string;
  location: string;
  price: string;
  numericPrice: number;
  currency: string;
  beds: number;
  baths: number;
  sqft: number;
  mlsNumber: string;
  architect: string;
  yearBuilt: number;
  heroImage: string;
  rooms: Room[];
  broker: {
    name: string;
    title: string;
    agency: string;
    phone: string;
    email: string;
    avatar: string;
  };
}

export interface PluginConfig {
  scrubSmoothing: number; // 1.0 to 3.0
  scrollSpeedFactor: number; // 0.2 to 1.0 (slower, cinematic)
  enableGlobalCheckpointGates?: boolean; // Whether room transition decision portals stop scroll
  cacheBufferThreshold: number; // percentage (e.g. 30%)
  enableWorkerPool: boolean;
  enableSoundScape: boolean;
  glassOpacity: number; // 0.05 to 0.35
  glassBlur: number; // 8 to 28 px
  accentTheme: 'champagne' | 'platinum' | 'emerald' | 'roseGold' | 'royalSlate';
  pinThreshold: number; // 0.8 to 0.98
  enableReturnMatrix: boolean;
  liteSpeedSafe: boolean;
  cssPrefix: string;
  autoplaySpeed: number;
  defaultFullscreen: boolean;
  language: 'fa' | 'en';
}

export interface AdminUser {
  username: string;
  email?: string;
  displayName: string;
  role: 'Super Admin' | 'Architect & Media Director';
  authProvider: 'credentials' | 'google';
  avatar?: string;
  lastLogin: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AdminUser | null;
}

export type ActiveTab = 'walkthrough' | 'elementor_builder' | 'video_optimizer' | 'plugin_code' | 'broker_roi' | 'admin_dashboard';
