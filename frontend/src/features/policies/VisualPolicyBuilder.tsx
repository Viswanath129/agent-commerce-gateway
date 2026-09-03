import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { formatInr } from '../../lib/formatters/index.js';
import type { MerchantPolicy } from '../../types/index.js';

export interface VisualPolicyBuilderProps {
  currentPolicy: MerchantPolicy | null;
  onApplyPolicy: (policy: MerchantPolicy) => Promise<void>;
  isApplying: boolean;
  onClose: () => void;
}

const PRESETS: Array<{
  id: string;
  name: string;
  badge: string;
  desc: string;
  limitInr: number;
  categories: string[];
  minMargin: number;
  autoRefund: boolean;
}> = [
  {
    id: 'd2c',
    name: 'D2C Retail & Electronics',
    badge: 'RECOMMENDED',
    desc: 'Balanced risk limit for consumer electronics and accessories with automated stockout protection.',
    limitInr: 10000,
    categories: ['electronics', 'accessories'],
    minMargin: 15,
    autoRefund: true,
  },
  {
    id: 'conservative',
    name: 'Conservative Enterprise',
    badge: 'LOW RISK',
    desc: 'Strict transaction ceiling with elevated minimum margin requirements for tight cost controls.',
    limitInr: 5000,
    categories: ['accessories'],
    minMargin: 25,
    autoRefund: true,
  },
  {
    id: 'quick_commerce',
    name: 'Quick Commerce / Micro-Purchases',
    badge: 'HIGH VELOCITY',
    desc: 'High velocity small-basket purchases with open category support and 10% target margin.',
    limitInr: 2500,
    categories: ['electronics', 'furniture', 'accessories', 'digital_goods'],
    minMargin: 10,
    autoRefund: true,
  },
  {
    id: 'luxury',
    name: 'High-Ticket & Furnishings',
    badge: 'EXPANDED CEILING',
    desc: 'High-cap authorization for furniture and high-end hardware suites with premium margins.',
    limitInr: 50000,
    categories: ['furniture', 'electronics'],
    minMargin: 30,
    autoRefund: true,
  },
];

const STANDARD_CATEGORIES = [
  'electronics',
  'furniture',
  'accessories',
  'apparel',
  'digital_goods',
  'hardware',
];

export const VisualPolicyBuilder: React.FC<VisualPolicyBuilderProps> = ({
  currentPolicy,
  onApplyPolicy,
  isApplying,
  onClose,
}) => {
  const [maxLimitInr, setMaxLimitInr] = useState<number>(
    currentPolicy ? Math.floor(currentPolicy.max_transaction_amount / 100) : 5000
  );
  const [categories, setCategories] = useState<string[]>(
    currentPolicy?.allowed_categories || ['electronics', 'furniture', 'accessories']
  );
  const [minMargin, setMinMargin] = useState<number>(
    currentPolicy?.min_margin_percentage || 15
  );
  const [autoRefund, setAutoRefund] = useState<boolean>(
    currentPolicy?.auto_refund_on_fulfillment_failure !== false
  );
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [nlPrompt, setNlPrompt] = useState('');
  const [mode, setMode] = useState<'visual' | 'dsl'>('visual');

  // Toggle category
  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      if (categories.length > 1) {
        setCategories(categories.filter((c) => c !== cat));
      }
    } else {
      setCategories([...categories, cat]);
    }
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCategoryInput.trim().toLowerCase();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setCustomCategoryInput('');
    }
  };

  // Apply preset
  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setMaxLimitInr(preset.limitInr);
    setCategories(preset.categories);
    setMinMargin(preset.minMargin);
    setAutoRefund(preset.autoRefund);
  };

  // Natural Language to Policy Compiler
  const handleCompileNlPrompt = () => {
    const p = nlPrompt.toLowerCase();
    if (!p) return;

    // Parse amount
    const amountMatch = p.match(/(?:limit|cap|max|under|to|rs\.?|₹|inr)\s*(\d+[\d,]*)/i) || p.match(/(\d+[\d,]*)\s*(?:inr|rs|rupees)/i);
    if (amountMatch) {
      const num = parseInt(amountMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(num) && num >= 100) {
        setMaxLimitInr(num);
      }
    }

    // Parse margin
    const marginMatch = p.match(/(\d+)\s*%\s*(?:margin|profit)?/i);
    if (marginMatch) {
      const m = parseInt(marginMatch[1], 10);
      if (!isNaN(m) && m >= 1 && m <= 50) {
        setMinMargin(m);
      }
    }

    // Parse categories
    const foundCats = STANDARD_CATEGORIES.filter((c) => p.includes(c));
    if (foundCats.length > 0) {
      setCategories(foundCats);
    }

    // Parse refund
    if (p.includes('no refund') || p.includes('disable refund')) {
      setAutoRefund(false);
    } else if (p.includes('refund') || p.includes('auto-refund')) {
      setAutoRefund(true);
    }
  };

  // Construct Next Policy Object
  const draftPolicy: MerchantPolicy = {
    policy_version: currentPolicy?.policy_version === 'pol_v1.0.0' ? 'pol_v2.0.0' : `pol_v${Date.now().toString().slice(-4)}.0`,
    effective_at: Math.floor(Date.now() / 1000),
    merchant_id: currentPolicy?.merchant_id || 'merch_acme_electronics_01',
    max_transaction_amount: maxLimitInr * 100, // paise
    allowed_categories: categories,
    auto_refund_on_fulfillment_failure: autoRefund,
    min_margin_percentage: minMargin,
  };

  const handleSubmit = async () => {
    await onApplyPolicy(draftPolicy);
  };

  return (
    <div className="relative overflow-hidden glass-panel rounded-xl p-6 sm:p-8 space-y-8 border border-[#C8B27A]/30 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#C8B27A] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-display text-2xl text-[#F4F0E6] font-normal tracking-wide">
              Visual Policy Studio
            </h3>
            <Badge variant="accent" size="sm">NO-CODE BUILDER</Badge>
          </div>
          <p className="text-xs font-mono text-[#BCB7AB] mt-1 font-light">
            Self-serve operational rule configuration with zero required JSON syntax knowledge
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#10100F] p-1 rounded-lg border border-white/10 text-xs font-mono">
            <button
              onClick={() => setMode('visual')}
              className={`px-3 py-1 rounded transition-all ${
                mode === 'visual'
                  ? 'bg-[#C8B27A] text-[#10100F] font-semibold'
                  : 'text-[#BCB7AB] hover:text-[#F4F0E6]'
              }`}
            >
              Visual Controls
            </button>
            <button
              onClick={() => setMode('dsl')}
              className={`px-3 py-1 rounded transition-all ${
                mode === 'dsl'
                  ? 'bg-[#C8B27A] text-[#10100F] font-semibold'
                  : 'text-[#BCB7AB] hover:text-[#F4F0E6]'
              }`}
            >
              DSL Diff View
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            CLOSE
          </Button>
        </div>
      </div>

      {/* 1-Click Industry Templates */}
      <div className="space-y-3">
        <label className="text-xs font-mono uppercase text-[#C8B27A] tracking-wider block font-semibold">
          1. Quick Industry Templates (1-Click Presets)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleApplyPreset(p)}
              className="text-left p-3.5 rounded-lg bg-[#10100F]/60 border border-white/10 hover:border-[#C8B27A]/60 transition-all space-y-1.5 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-[#F4F0E6] group-hover:text-[#C8B27A] transition-colors">
                  {p.name}
                </span>
                <span className="text-[9px] font-mono text-[#7A776F] uppercase">
                  {p.badge}
                </span>
              </div>
              <p className="text-[11px] font-ui text-[#BCB7AB] line-clamp-2 leading-relaxed font-light">
                {p.desc}
              </p>
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-[#6F9B83]">
                <span>Max: ₹{p.limitInr.toLocaleString('en-IN')}</span>
                <span>{p.minMargin}% Margin</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Natural Language Prompt Assistant */}
      <div className="p-4 rounded-lg bg-[rgba(200,178,122,0.06)] border border-[#C8B27A]/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-[#C8B27A] uppercase tracking-wider flex items-center gap-2">
            <span>✨</span> Natural Language Policy Assistant
          </span>
          <span className="text-[10px] font-mono text-[#BCB7AB]">Instant Rule Parsing</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder='e.g. "Allow electronics and accessories up to ₹15,000 with 20% margin and auto-refund on stockout"'
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCompileNlPrompt()}
            className="flex-1 bg-[#10100F]/90 border border-white/10 rounded-md p-2.5 text-xs font-mono text-[#F4F0E6] focus:outline-none focus:border-[#C8B27A]"
          />
          <Button variant="glass" size="sm" onClick={handleCompileNlPrompt}>
            PARSE TO RULES
          </Button>
        </div>
      </div>

      {/* Mode Switcher Container */}
      {mode === 'visual' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Spending & Margins */}
          <div className="space-y-6">
            {/* Spending Limit Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#BCB7AB] uppercase">MAX SINGLE ORDER CAP (INR)</span>
                <span className="text-[#6F9B83] text-sm font-bold">
                  ₹{maxLimitInr.toLocaleString('en-IN')}.00
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="50000"
                step="500"
                value={maxLimitInr}
                onChange={(e) => setMaxLimitInr(Number(e.target.value))}
                className="w-full accent-[#C8B27A] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#7A776F]">
                <span>₹500</span>
                <span>₹25,000</span>
                <span>₹50,000</span>
              </div>
            </div>

            {/* Minimum Margin Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#BCB7AB] uppercase">MINIMUM PROFIT MARGIN (%)</span>
                <span className="text-[#C8B27A] text-sm font-bold">{minMargin}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={minMargin}
                onChange={(e) => setMinMargin(Number(e.target.value))}
                className="w-full accent-[#C8B27A] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#7A776F]">
                <span>5% (Volume)</span>
                <span>20% (Standard)</span>
                <span>40% (High-Margin)</span>
              </div>
            </div>

            {/* Auto Refund Toggle */}
            <div className="p-4 rounded-lg bg-[#10100F]/60 border border-white/10 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold text-[#F4F0E6] block">
                  Automated Stockout Refund
                </span>
                <span className="text-[11px] font-ui text-[#BCB7AB] block font-light">
                  Trigger idempotent Razorpay refunds if warehouse fulfillment fails post-payment capture
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoRefund(!autoRefund)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  autoRefund ? 'bg-[#6F9B83]' : 'bg-[#7A776F]/30'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    autoRefund ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Right Column: Category Selection */}
          <div className="space-y-4">
            <span className="text-xs font-mono uppercase text-[#BCB7AB] tracking-wider block">
              AUTHORIZED CATEGORY WHITELIST
            </span>
            <div className="flex flex-wrap gap-2">
              {STANDARD_CATEGORIES.map((cat) => {
                const isSelected = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#C8B27A]/20 border-[#C8B27A] text-[#F4F0E6] font-semibold'
                        : 'bg-[#10100F]/60 border-white/10 text-[#7A776F] hover:border-white/20'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <label className="text-[11px] font-mono text-[#7A776F] block">
                Add Custom Category Tag:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. smart_home"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
                  className="flex-1 bg-[#10100F]/90 border border-white/10 rounded-md p-2 text-xs font-mono text-[#F4F0E6] focus:outline-none focus:border-[#C8B27A]"
                />
                <Button variant="glass" size="xs" onClick={handleAddCustomCategory}>
                  ADD TAG
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DSL Diff View */
        <div className="space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center text-[11px] text-[#7A776F]">
            <span>Active Policy DSL (Live In-Memory)</span>
            <span className="text-[#C8B27A]">Proposed Version ({draftPolicy.policy_version})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre className="p-4 rounded-lg bg-[#10100F] border border-white/10 text-[#BCB7AB] overflow-x-auto text-[11px]">
              {JSON.stringify(currentPolicy, null, 2)}
            </pre>
            <pre className="p-4 rounded-lg bg-[#10100F] border border-[#C8B27A]/40 text-[#6F9B83] overflow-x-auto text-[11px]">
              {JSON.stringify(draftPolicy, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/[0.08]">
        <div className="text-xs font-mono text-[#BCB7AB] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#6F9B83] animate-pulse" />
          <span>Target Policy Version: <strong className="text-[#F4F0E6]">{draftPolicy.policy_version}</strong></span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 sm:flex-none">
            CANCEL
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isApplying}
            onClick={handleSubmit}
            className="flex-1 sm:flex-none"
          >
            ACTIVATE & PERSIST POLICY
          </Button>
        </div>
      </div>
    </div>
  );
};
