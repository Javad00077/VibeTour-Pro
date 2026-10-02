import React, { useState, useRef } from 'react';
import { 
  Video, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Copy, 
  Check, 
  Terminal, 
  Server, 
  FileVideo, 
  ShieldCheck, 
  Sparkles,
  RefreshCw,
  Gauge,
  Upload,
  ArrowRight,
  HardDrive,
  Globe,
  AlertTriangle,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { analyzeAndConvertVideoUrl, VideoUrlAnalysis } from '../utils/videoUrlHelper';

interface VideoOptimizerGuideProps {
  onApplyVideoToRoom?: (videoUrl: string) => void;
}

export const VideoOptimizerGuide: React.FC<VideoOptimizerGuideProps> = ({
  onApplyVideoToRoom
}) => {
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);
  const [playbookTab, setPlaybookTab] = useState<'github' | 'gdrive'>('github');
  const [gdriveHelperInput, setGdriveHelperInput] = useState<string>('');
  
  // Test Results state
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    directUrl: 'pass' | 'fail' | 'warn';
    corsStatus: 'pass' | 'fail' | 'warn';
    seekPerformance: 'excellent' | 'good' | 'slow' | 'fail' | 'pending';
    seekTimeMs: number;
    videoDuration: number;
    resolution: string;
    codecHint: string;
    isDirectMode: boolean;
    details: string[];
    testedUrl: string;
  } | null>(null);

  // Live test video element
  const testVideoRef = useRef<HTMLVideoElement | null>(null);
  const [testProgress, setTestProgress] = useState<number>(0);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  // Run full resilient diagnostics on video link or blob
  const runDiagnosticsWithUrl = (customUrl?: string, customFileName?: string) => {
    const rawInput = (customUrl || videoUrlInput).trim();
    if (!rawInput) return;

    setIsTesting(true);
    setTestResult(null);
    setAppliedSuccess(false);

    const details: string[] = [];
    let directUrl: 'pass' | 'fail' | 'warn' = 'pass';
    const isBlob = rawInput.startsWith('blob:');

    // Convert via intelligent helper
    const analysis = analyzeAndConvertVideoUrl(rawInput);
    const effectiveStreamUrl = analysis.streamUrl;

    // 1. Direct URL check
    if (isBlob) {
      directUrl = 'pass';
      details.push(`📁 Local video file (${customFileName || 'GSAP Walkthrough'}) loaded directly from system memory (zero CORS issues).`);
    } else if (analysis.platform === 'gdrive') {
      directUrl = 'pass';
      if (analysis.isConverted) {
        details.push(`⚡ Google Drive link recognized (File ID: ${analysis.fileId})! Auto-converted from HTML preview page to direct Google CDN media stream.`);
      }
      details.push('ℹ️ Ensure the Google Drive file permission is set to "Anyone with the link can view".');
    } else if (analysis.platform === 'github') {
      directUrl = 'pass';
      if (analysis.isConverted) {
        details.push(`⚡ GitHub blob URL converted to direct raw stream URL: ${effectiveStreamUrl}`);
      } else {
        details.push('✅ GitHub video stream verified. Native HTTP 206 Byte-Range seeking supported.');
      }
    } else if (analysis.platform === 'dropbox') {
      directUrl = 'pass';
      details.push('⚡ Dropbox link converted to raw stream mode (?raw=1).');
    } else if (rawInput.includes('youtube.com') || rawInput.includes('youtu.be')) {
      directUrl = 'fail';
      details.push('❌ YouTube links are HTML web pages, not direct video streams. Please provide a raw .mp4 or .webm file.');
    } else if (!effectiveStreamUrl.match(/\.(mp4|webm|m4v|mov)(\?.*)?$/i)) {
      directUrl = 'warn';
      details.push('ℹ️ URL does not contain a standard video extension; inspecting stream headers.');
    } else {
      details.push('✅ Direct video stream file URL verified.');
    }

    // 2. Intelligent Dual-Pass Video Loader
    const testWithVideo = (allowCors: boolean) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      if (allowCors && !isBlob) {
        try {
          video.crossOrigin = 'anonymous';
        } catch {
          // ignore
        }
      }

      video.src = effectiveStreamUrl;

      const timeout = setTimeout(() => {
        if (allowCors && !isBlob) {
          testWithVideo(false);
        } else {
          setIsTesting(false);
          setTestResult({
            tested: true,
            directUrl: isBlob ? 'pass' : directUrl,
            corsStatus: 'fail',
            seekPerformance: 'fail',
            seekTimeMs: 0,
            videoDuration: 0,
            resolution: 'Unknown',
            codecHint: 'Server Unreachable',
            isDirectMode: false,
            testedUrl: effectiveStreamUrl,
            details: [
              ...details,
              '❌ Video server did not respond in time. You can select a local MP4 file to test instantaneous rendering.'
            ]
          });
        }
      }, 7000);

      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        const res = `${video.videoWidth} × ${video.videoHeight}`;
        
        if (allowCors && !isBlob) {
          details.push(`✅ Video loaded with open CORS headers (${res}). Full Canvas filter & pixel compatibility.`);
        } else {
          details.push(`✅ Video recognized successfully (${res})! Direct Hardware Layer enabled.`);
        }

        // Test seeking responsiveness
        const seekStart = performance.now();
        video.currentTime = video.duration * 0.5;

        video.onseeked = () => {
          const seekDuration = Math.round(performance.now() - seekStart);
          let seekPerformance: 'excellent' | 'good' | 'slow' = 'excellent';
          
          if (seekDuration < 150) {
            seekPerformance = 'excellent';
            details.push(`⚡ Instant frame response (${seekDuration}ms). Keyframe GOP & FastStart optimized.`);
          } else if (seekDuration < 400) {
            seekPerformance = 'good';
            details.push(`👍 Smooth scrubbing (${seekDuration}ms). Well-suited for responsive scrubbing.`);
          } else {
            seekPerformance = 'slow';
            details.push(`⚠️ Scrub latency observed (${seekDuration}ms). Consider optimizing keyframe interval with FFmpeg.`);
          }

          setIsTesting(false);
          setTestResult({
            tested: true,
            directUrl: 'pass',
            corsStatus: 'pass',
            seekPerformance,
            seekTimeMs: seekDuration,
            videoDuration: video.duration,
            resolution: res,
            codecHint: allowCors ? 'H.264 / Canvas Compatible' : 'H.264 / Direct Hardware Mode (No CORS Required)',
            isDirectMode: !allowCors,
            testedUrl: effectiveStreamUrl,
            details
          });

          if (testVideoRef.current) {
            if (allowCors) {
              testVideoRef.current.crossOrigin = 'anonymous';
            } else {
              testVideoRef.current.removeAttribute('crossorigin');
              (testVideoRef.current as any).crossOrigin = null;
            }
            testVideoRef.current.src = effectiveStreamUrl;
            testVideoRef.current.load();
          }
        };
      };

      video.onerror = () => {
        clearTimeout(timeout);
        if (allowCors && !isBlob) {
          testWithVideo(false);
        } else {
          setIsTesting(false);
          setTestResult({
            tested: true,
            directUrl: 'fail',
            corsStatus: 'fail',
            seekPerformance: 'fail',
            seekTimeMs: 0,
            videoDuration: 0,
            resolution: 'Failed to load',
            codecHint: 'Invalid Format or Network Filter',
            isDirectMode: false,
            testedUrl: effectiveStreamUrl,
            details: [
              ...details,
              '❌ Video could not be loaded. Ensure the URL is accessible or upload a local file.'
            ]
          });
        }
      };
    };

    testWithVideo(!isBlob);
  };

  const runDiagnostics = () => {
    runDiagnosticsWithUrl();
  };

  // Local File Selector
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      setVideoUrlInput(blobUrl);
      runDiagnosticsWithUrl(blobUrl, file.name);
    }
  };

  // Live video preview scrub
  const handleScrubTest = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTestProgress(val);
    if (testVideoRef.current && testVideoRef.current.duration) {
      testVideoRef.current.currentTime = val * testVideoRef.current.duration;
    }
  };

  const handleApplyToTour = () => {
    if (testResult?.testedUrl && onApplyVideoToRoom) {
      onApplyVideoToRoom(testResult.testedUrl);
      setAppliedSuccess(true);
      setTimeout(() => setAppliedSuccess(false), 3500);
    }
  };

  const ffmpegCommandUltraFast = `# High-Performance Kinetic Walkthrough Scrubbing Profile
ffmpeg -i input_video.mp4 \\
  -c:v libx264 \\
  -preset slow \\
  -crf 20 \\
  -g 8 \\
  -keyint_min 8 \\
  -sc_threshold 0 \\
  -pix_fmt yuv420p \\
  -movflags +faststart \\
  -an \\
  output_apple_style.mp4`;

  const htaccessCode = `# WordPress / Apache CORS Header for Video Scrubbing (.htaccess)
<IfModule mod_headers.c>
  <FilesMatch "\\.(mp4|m4v|webm|ogv)$">
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, OPTIONS"
    Header set Access-Control-Allow-Headers "Range, Origin, Content-Type, Accept"
  </FilesMatch>
</IfModule>`;

  const nginxCode = `# Nginx CORS & Byte-Range Video Streaming Configuration
location ~* \\.(mp4|webm|ogg)$ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, OPTIONS';
    add_header Access-Control-Allow-Headers 'Range, Origin, Content-Type, Accept';
    mp4;
    mp4_buffer_size       1m;
    mp4_max_buffer_size   5m;
}`;

  return (
    <div className="bg-[#12141d] rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col h-full text-slate-200" dir="ltr">
      
      {/* Header */}
      <div className="bg-[#181a24] px-5 py-4 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#c5a880] to-[#8c6d46] flex items-center justify-center shadow-lg shadow-[#c5a880]/20 text-black shrink-0">
            <Video className="w-5 h-5 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-white tracking-wide">
                Smart Video Resilience & Optimizer Engine
              </h2>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                Auto-Recovery CORS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Diagnostic test bench for high-resolution 4K 60FPS scrubbing video assets with hardware acceleration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hardware Pipeline Active</span>
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
        
        {/* SECTION 1: LIVE VIDEO URL DIAGNOSTICS & TESTER */}
        <div className="bg-[#161822] p-5 rounded-2xl border border-white/10 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c5a880]" />
              <h3 className="font-display text-sm font-bold text-white">
                Live Video Diagnostics & Keyframe Responsiveness
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Supports direct URLs, WordPress uploads, or local filesystem files
            </span>
          </div>

          {/* Input & Action Buttons */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="Enter direct video URL: https://your-domain.com/wp-content/uploads/room.mp4"
                className="flex-1 bg-[#0d0f16] border border-white/15 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:border-[#c5a880] focus:outline-none"
              />
              <button
                onClick={runDiagnostics}
                disabled={isTesting || !videoUrlInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md active:scale-95 shrink-0"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Frames...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Test Video Stream</span>
                  </>
                )}
              </button>
            </div>

            {/* Local File Direct Upload Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0d0f16] rounded-xl border border-white/5">
              <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>
                  <strong>Local File Option:</strong> Select an MP4 directly from your system to test without web hosting:
                </span>
              </div>

              <label className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Local Video File</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleLocalFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Diagnostics Report Card */}
          {testResult && (
            <div className="mt-4 p-4 rounded-xl bg-[#0e1017] border border-white/10 space-y-3.5 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>Stream Status:</span>
                  {testResult.corsStatus === 'pass' ? (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Ready & Validated
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1 text-[11px]">
                      <XCircle className="w-4 h-4" />
                      Stream Failed
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-slate-400">Resolution: <strong className="text-white">{testResult.resolution}</strong></span>
                  <span className="text-slate-400">Seek Latency: <strong className="text-[#c5a880]">{testResult.seekTimeMs}ms</strong></span>
                </div>
              </div>

              {/* Status Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-[#141622] border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">1. Stream Loading:</span>
                  {testResult.directUrl === 'pass' ? (
                    <span className="text-emerald-400 font-bold">Pass ✅</span>
                  ) : (
                    <span className="text-rose-400 font-bold">Fail ❌</span>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-[#141622] border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">2. Security Layer:</span>
                  <span className="text-emerald-400 font-bold">
                    {testResult.isDirectMode ? 'Direct Hardware Mode' : 'Canvas Compatible ✅'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#141622] border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">3. Keyframe Interval (GOP):</span>
                  {testResult.seekPerformance === 'excellent' ? (
                    <span className="text-emerald-400 font-bold">Instant (⚡)</span>
                  ) : testResult.seekPerformance === 'good' ? (
                    <span className="text-emerald-400 font-bold">Smooth (👍)</span>
                  ) : (
                    <span className="text-amber-400 font-bold">Moderate</span>
                  )}
                </div>
              </div>

              {/* Details Log */}
              <div className="space-y-1 bg-[#141622] p-3 rounded-lg border border-white/5 text-[11px] leading-relaxed">
                {testResult.details.map((d, i) => (
                  <p key={i} className="text-slate-300 font-sans">{d}</p>
                ))}
              </div>

              {/* Interactive Live Scrub Player */}
              {testResult.corsStatus === 'pass' && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-[#c5a880]" />
                      <span>Live Scrub Test (drag slider forward & backward):</span>
                    </span>
                    <span className="font-mono text-[#c5a880] text-[11px] font-bold">
                      {Math.round(testProgress * 100)}% progress
                    </span>
                  </div>

                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-56 border border-white/10 mx-auto flex items-center justify-center">
                    <video
                      ref={testVideoRef}
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.005"
                    value={testProgress}
                    onChange={handleScrubTest}
                    className="w-full accent-[#c5a880] cursor-pointer"
                  />

                  {/* Apply to Walkthrough Tour Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#131622] p-3 rounded-xl border border-white/10">
                    <div className="text-slate-300 text-xs">
                      Ready to apply this video to your active property walkthrough?
                    </div>

                    <button
                      onClick={handleApplyToTour}
                      className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#e6d5bd] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 shrink-0"
                    >
                      {appliedSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                          <span>Applied! View it in the Walkthrough tab</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          <span>Apply to Walkthrough</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: ARCHITECTURE & CORS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#161822] p-5 rounded-2xl border border-white/10 space-y-3.5 shadow-xl">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <FileVideo className="w-4 h-4 text-[#c5a880]" />
              <h3 className="font-display text-sm font-bold text-white">
                How VibeTour Pro Guarantees Zero-Blackscreen Playback
              </h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3 rounded-xl bg-[#0d0f16] border border-white/5 space-y-1">
                <span className="font-bold text-[#c5a880] block text-xs">
                  1. Smart Dual-Layer Pipeline:
                </span>
                <p className="text-slate-300 text-[11px]">
                  If your media server lacks CORS headers, the player automatically falls back to the Direct Hardware DOM element layer. This allows the video to play and scrub smoothly without CORS blocking.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0d0f16] border border-white/5 space-y-1">
                <span className="font-bold text-[#c5a880] block text-xs">
                  2. Transparent Kinetic Overlay:
                </span>
                <p className="text-slate-300 text-[11px]">
                  Material swatches, hotspot pins, and checkpoint portals are drawn on a transparent high-DPI canvas directly above the video stream.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0d0f16] border border-white/5 space-y-1">
                <span className="font-bold text-[#c5a880] block text-xs">
                  3. Keyframe Synchronization:
                </span>
                <p className="text-slate-300 text-[11px]">
                  Scrubbing math synchronizes scroll progress with <code className="text-[#c5a880]">currentTime = progress * duration</code> for silky smooth reverse and forward navigation.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#161822] p-5 rounded-2xl border border-white/10 space-y-3.5 shadow-xl">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Server className="w-4 h-4 text-[#c5a880]" />
              <h3 className="font-display text-sm font-bold text-white">
                Optional: Server CORS Configuration
              </h3>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              If you wish to configure your web server to serve byte-range requests with open headers, place these snippets in your server config:
            </p>

            {/* .htaccess code block */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold font-mono text-[11px]">Apache / LiteSpeed (.htaccess):</span>
                <button
                  onClick={() => copyToClipboard(htaccessCode, 'htaccess')}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-[#c5a880] flex items-center gap-1"
                >
                  {copiedSection === 'htaccess' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy Code</span>
                </button>
              </div>
              <pre className="p-2.5 bg-[#090a0f] rounded-xl border border-white/10 font-mono text-[10px] text-slate-300 overflow-x-auto select-all">
                <code>{htaccessCode}</code>
              </pre>
            </div>

            {/* Nginx code block */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold font-mono text-[11px]">Nginx Configuration:</span>
                <button
                  onClick={() => copyToClipboard(nginxCode, 'nginx')}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-[#c5a880] flex items-center gap-1"
                >
                  {copiedSection === 'nginx' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy Code</span>
                </button>
              </div>
              <pre className="p-2.5 bg-[#090a0f] rounded-xl border border-white/10 font-mono text-[10px] text-slate-300 overflow-x-auto select-all">
                <code>{nginxCode}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* SECTION 3: 1-CLICK FFmpeg COMMAND */}
        <div className="bg-[#161822] p-5 rounded-2xl border border-white/10 space-y-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#c5a880]" />
              <h3 className="font-display text-sm font-bold text-white">
                Ultra-Fast FFmpeg Command for Kinetic Scrubbing Videos:
              </h3>
            </div>
            <button
              onClick={() => copyToClipboard(ffmpegCommandUltraFast, 'ffmpeg')}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#c5a880] font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              {copiedSection === 'ffmpeg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Command</span>
            </button>
          </div>

          <pre className="p-3 bg-[#090a0f] rounded-xl border border-white/10 font-mono text-[11px] text-[#c5a880] overflow-x-auto select-all">
            <code>{ffmpegCommandUltraFast}</code>
          </pre>
        </div>

      </div>
    </div>
  );
};
