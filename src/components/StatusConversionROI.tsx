import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  Zap, 
  Award, 
  CheckCircle, 
  XCircle, 
  Copy, 
  Sparkles,
  ArrowRight,
  Calculator,
  Flame
} from 'lucide-react';

export const StatusConversionROI: React.FC = () => {
  const [avgPrice, setAvgPrice] = useState<number>(8500000);
  const [listingsCount, setListingsCount] = useState<number>(6);
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false);

  // ROI calculations
  const totalVolume = avgPrice * listingsCount;
  const standardCommission = totalVolume * 0.025; // 2.5% typical luxury broker side
  const estimatedConversionLift = 0.22; // 22% lift in serious HNW buyer engagement
  const addedCommissionValue = standardCommission * estimatedConversionLift;
  const devCostSavings = listingsCount * 2400; // $2,400 saved per custom 3D dev project
  const totalFinancialImpact = addedCommissionValue + devCostSavings;

  const handleCopyPitch = () => {
    const pitchText = `SUBJECT: Elevating Our Luxury Real Estate Portfolio to Apple-Grade Cinematic Walkthroughs

Dear Team / Managing Partner,

Traditional 3D scans (like Matterport) look clinical and suffer from high bounce rates among High-Net-Worth buyers browsing on mobile devices.

We are implementing VibeTour Pro for our premium listings:
1. Apple-Style Kinetic Walkthroughs: 60fps scroll-scrubbed interactive canvas tours that hold buyer attention 4x longer.
2. Instant WordPress & Elementor Integration: Cuts our listing media turnaround from weeks to under 15 minutes, saving over $2,400 per property in custom web development.
3. 100% Mobile & Cache Optimized: Zero lag or freezing on iPhone Safari and fully compatible with high-speed caching setups.

Estimated Portfolio Impact: +$${Math.round(totalFinancialImpact).toLocaleString()} in listing prestige conversion and operational savings.`;

    navigator.clipboard.writeText(pitchText);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  return (
    <div className="bg-[#12141d] rounded-2xl border border-white/10 shadow-2xl p-6 lg:p-8 space-y-8 text-slate-200">
      {/* Top Value Prop Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#c5a880] px-3 py-1 rounded-full bg-[#c5a880]/10 border border-[#c5a880]/30 inline-block">
          Monetization & Status Conversion Blueprint
        </span>
        <h2 className="font-display text-2xl lg:text-3xl font-bold text-white tracking-wide">
          Don’t Sell Software. Sell a <span className="text-[#c5a880]">Status Conversion Engine</span>.
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 font-light leading-relaxed">
          How luxury brokerages in London, New York, Monaco, and Paris leverage VibeTour Pro to keep ultra-high-net-worth buyers engaged 4x longer.
        </p>
      </div>

      {/* Comparison Matrix: Matterport vs VibeTour Pro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Legacy 3D Scans / Matterport */}
        <div className="p-5 rounded-2xl bg-[#0e1017] border border-red-500/20 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="font-display text-sm font-semibold text-slate-300 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span>Legacy 3D Virtual Tours (e.g., Matterport)</span>
            </span>
            <span className="text-[10px] text-red-400 font-mono">High Bounce Rate</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span><strong>Clinical dollhouse look:</strong> Feels like a technical architectural survey rather than an emotional luxury home movie.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span><strong>Slow initial load:</strong> Heavy 80MB WebGL assets trigger immediate drop-offs on mobile 5G connections.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span><strong>Subscription lock-in:</strong> Requires costly ongoing monthly hosting per active space.</span>
            </li>
          </ul>
        </div>

        {/* VibeTour Pro */}
        <div className="p-5 rounded-2xl bg-[#161926] border border-[#c5a880]/40 space-y-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="font-display text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#c5a880]" />
              <span>VibeTour Pro (Apple-Style Kinetic Walkthrough)</span>
            </span>
            <span className="text-[10px] text-[#c5a880] font-mono font-bold">Status Multiplier</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-[#c5a880] mt-0.5">•</span>
              <span><strong>Editorial, cinematic immersion:</strong> Scroll-scrubbed 60fps canvas feels like an interactive Architectural Digest cover story.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c5a880] mt-0.5">•</span>
              <span><strong>Sub-second startup:</strong> Preload skeletal buffer unfreezes at 30% cache, guaranteeing zero mobile stutter.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c5a880] mt-0.5">•</span>
              <span><strong>Zero monthly host fees:</strong> 100% self-hosted on your own WordPress & Elementor infrastructure.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Interactive Financial Lift & ROI Calculator */}
      <div className="p-6 rounded-2xl bg-[#0e1017] border border-white/10 space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <Calculator className="w-5 h-5 text-[#c5a880]" />
          <h3 className="font-display text-base font-bold text-white">
            Brokerage Revenue & Cost-Savings Calculator
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sliders */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Average Luxury Listing Value:</span>
                <span className="font-mono font-bold text-[#c5a880]">
                  ${avgPrice.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="2000000"
                max="40000000"
                step="500000"
                value={avgPrice}
                onChange={(e) => setAvgPrice(parseInt(e.target.value))}
                className="w-full accent-[#c5a880] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Annual Luxury Listings Managed:</span>
                <span className="font-mono font-bold text-[#c5a880]">
                  {listingsCount} Listings / Year
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={listingsCount}
                onChange={(e) => setListingsCount(parseInt(e.target.value))}
                className="w-full accent-[#c5a880] cursor-pointer"
              />
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#141724] border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-slate-400">Total Portfolio Value</span>
              <span className="font-display text-lg font-bold text-white mt-1">
                ${(totalVolume / 1000000).toFixed(1)}M
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141724] border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-slate-400">Direct Dev Cost Saved</span>
              <span className="font-display text-lg font-bold text-emerald-400 mt-1">
                +${devCostSavings.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141724] border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-slate-400">Buyer Dwell Time Lift</span>
              <span className="font-display text-lg font-bold text-[#c5a880] mt-1">
                4.2x Longer
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#1d1a14] to-[#2b2419] border border-[#c5a880]/40 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-[#c5a880]">Est. Revenue Acceleration</span>
              <span className="font-display text-lg font-bold text-[#e6d5bd] mt-1">
                +${Math.round(totalFinancialImpact).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyable Broker Pitch Generator */}
      <div className="p-5 rounded-2xl bg-[#161822] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-display text-sm font-bold text-white">
            Client Listing Proposal & Pitch Template
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            1-Click copy of the high-converting email pitch to send to property sellers and managing brokers.
          </p>
        </div>

        <button
          onClick={handleCopyPitch}
          className="px-4 py-2 rounded-xl bg-[#c5a880] hover:bg-[#e6d5bd] text-black font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
        >
          {copiedPitch ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Pitch Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Broker Pitch Email</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
