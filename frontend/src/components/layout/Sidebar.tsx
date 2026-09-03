import React from 'react';
import { NAVIGATION_ITEMS, type NavItemDef } from '../../lib/constants/index.js';
import type { TabId } from '../../types/index.js';

export interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  merchantId?: string;
  policyVersion?: string;
  isDbConnected?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  merchantId = 'merch_acme_electronics_01',
  policyVersion = 'pol_v1.0.0',
  isDbConnected = true,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-[280px] bg-[#121210]/90 backdrop-blur-2xl flex flex-col border-r border-white/[0.08] z-50 select-none transition-transform duration-200 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.5)] ${
        isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="relative p-6 border-b border-white/[0.08] flex items-center justify-between">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="flex items-center gap-3.5">
          <div className="relative w-8 h-8 rounded-md bg-gradient-to-br from-[#E4D5B0] via-[#C8B27A] to-[#A8945D] flex items-center justify-center font-mono text-sm font-bold text-[#10100F] shadow-[0_2px_10px_rgba(200,178,122,0.3)]">
            <span className="absolute inset-x-0 top-0 h-[1px] bg-white/40 rounded-t-md" />
            A
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl tracking-wider uppercase font-semibold text-[#F4F0E6]">
              ACG
            </span>
            <span className="text-[9px] font-mono text-[#C8B27A] tracking-widest uppercase font-medium">
              AGENT COMMERCE GATEWAY
            </span>
          </div>
        </div>

        {/* Mobile Close Button (44px touch area) */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#BCB7AB] hover:text-[#F4F0E6] cursor-pointer"
            aria-label="Close navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {NAVIGATION_ITEMS.map((item: NavItemDef) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as TabId)}
              className={`relative w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-mono transition-all duration-200 text-left rounded-md overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-r from-[#C8B27A]/15 to-transparent text-[#F4F0E6] font-semibold border-l-2 border-[#C8B27A] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                  : 'text-[#BCB7AB] hover:text-[#F4F0E6] hover:bg-white/[0.04] border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? 'text-[#C8B27A]' : 'text-[#7A776F]'
                  }`}
                >
                  {item.num}
                </span>
                <span className="tracking-wide">{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#C8B27A]/40 text-[#C8B27A] bg-[#C8B27A]/10 font-mono shadow-[0_0_8px_rgba(200,178,122,0.15)]">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Operational Status Panel */}
      <div className="mt-auto border-t border-white/[0.08] p-4 space-y-3 bg-[#0E0E0D]/90 text-[11px] font-mono relative">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between text-[#BCB7AB]">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isDbConnected ? 'bg-[#6F9B83]' : 'bg-[#A76565]'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isDbConnected ? 'bg-[#6F9B83]' : 'bg-[#A76565]'
                }`}
              />
            </span>
            <span className="text-[10px] font-medium">{isDbConnected ? 'SQLITE LIVE' : 'DB OFFLINE'}</span>
          </span>
          <span className="text-[9px] text-[#C8B27A] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-[#C8B27A]/10 border border-[#C8B27A]/30">
            ZERO-MOCK
          </span>
        </div>

        <div className="pt-2 border-t border-white/[0.04] flex flex-col gap-0.5">
          <span className="text-[9px] text-[#7A776F] uppercase tracking-widest">
            Merchant Partition
          </span>
          <span className="text-[#F4F0E6] truncate text-[10px] font-mono">{merchantId}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-[#7A776F] uppercase tracking-widest">
            Active Policy DSL
          </span>
          <span className="text-[#C8B27A] text-[10px] font-medium font-mono">{policyVersion}</span>
        </div>
      </div>
    </aside>
  );
};
