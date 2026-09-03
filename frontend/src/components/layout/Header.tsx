import React from 'react';
import { Button } from '../ui/Button.js';
import { TENANT_CONFIG } from '../../lib/constants/index.js';

export interface HeaderProps {
  onSync: () => void;
  isSyncing: boolean;
  syncTimestamp?: string;
  activeTabTitle?: string;
  onToggleMobile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSync,
  isSyncing,
  syncTimestamp,
  activeTabTitle,
  onToggleMobile,
}) => {
  return (
    <header className="fixed top-0 left-0 lg:left-[280px] right-0 h-16 glass-toolbar z-40 px-4 md:px-8 flex items-center justify-between border-b border-white/[0.08] transition-all duration-200">
      {/* Top Specular Rim */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Left Details + Mobile Hamburger */}
      <div className="flex items-center gap-3 md:gap-6 text-xs font-mono">
        {onToggleMobile && (
          <button
            onClick={onToggleMobile}
            className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#BCB7AB] hover:text-[#F4F0E6] cursor-pointer"
            aria-label="Open navigation drawer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[#7A776F] uppercase hidden sm:inline">ENVIRONMENT:</span>
          <span className="text-[#C8B27A] font-semibold tracking-wider bg-[#C8B27A]/10 px-2 py-0.5 rounded border border-[#C8B27A]/25 text-[11px]">
            {TENANT_CONFIG.environment}
          </span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-white/10" />
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[#7A776F] uppercase">SETTLEMENT RAIL:</span>
          <span className="text-[#F4F0E6] font-medium tracking-wider text-[11px]">
            {TENANT_CONFIG.rails}
          </span>
        </div>
        {activeTabTitle && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <div className="text-[#BCB7AB] uppercase font-display text-sm tracking-wider font-medium">
              {activeTabTitle}
            </div>
          </>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Zero-Mock Guarantee Pill */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-[#6F9B83]/40 bg-[#6F9B83]/15 text-[#6F9B83] text-[10px] font-mono uppercase tracking-widest font-semibold backdrop-blur-md shadow-[0_0_12px_rgba(111,155,131,0.2)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6F9B83] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6F9B83]" />
          </span>
          <span>ZERO-MOCK ACTIVE</span>
        </div>

        {/* Sync Button */}
        <Button
          variant="glass"
          size="sm"
          isLoading={isSyncing}
          onClick={onSync}
          leftIcon={
            <svg
              className={`w-3.5 h-3.5 text-[#C8B27A] ${isSyncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          }
        >
          {isSyncing ? 'SYNCING...' : 'SYNC'}
        </Button>
      </div>
    </header>
  );
};
