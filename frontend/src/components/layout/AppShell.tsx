import React from 'react';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import type { TabId } from '../../types/index.js';

export interface AppShellProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onSync: () => void;
  isSyncing: boolean;
  syncTimestamp?: string;
  merchantId?: string;
  policyVersion?: string;
  isDbConnected?: boolean;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onSelectTab,
  onSync,
  isSyncing,
  syncTimestamp,
  merchantId,
  policyVersion,
  isDbConnected,
  children,
}) => {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const handleSelectTab = (tab: TabId) => {
    onSelectTab(tab);
    setIsMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0C0C0B] text-[#F4F0E6] font-ui flex relative overflow-x-hidden selection:bg-[#C8B27A] selection:text-[#10100F]">
      {/* Dynamic iOS 26 Ambient Light Canvas */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Top-Right Champagne Gold Aurora */}
        <div className="absolute -top-[100px] right-[12%] w-[700px] h-[460px] bg-gradient-to-br from-[#C8B27A]/20 via-[#E4D5B0]/10 to-transparent rounded-full blur-[110px] animate-pulse-slow" />
        
        {/* Bottom-Left Sage Mint Refraction Aurora */}
        <div className="absolute -bottom-[80px] left-[18%] w-[600px] h-[420px] bg-gradient-to-tr from-[#6F9B83]/16 via-[#6F9B83]/6 to-transparent rounded-full blur-[120px]" />
        
        {/* Center Ambient Spotlight */}
        <div className="absolute top-[8%] left-[30%] w-[500px] h-[340px] bg-[#C8B27A]/12 rounded-full blur-[130px]" />
        
        {/* Radial Depth Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(200,178,122,0.12),rgba(0,0,0,0))]" />
      </div>

      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 lg:hidden cursor-pointer transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Persistent Left Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        merchantId={merchantId}
        policyVersion={policyVersion}
        isDbConnected={isDbConnected}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main App Container */}
      <div className="flex-1 lg:pl-[280px] pl-0 flex flex-col min-w-0 transition-all duration-200 relative z-10">
        {/* Fixed Top Bar */}
        <Header
          onSync={onSync}
          isSyncing={isSyncing}
          syncTimestamp={syncTimestamp}
          onToggleMobile={() => setIsMobileOpen(!isMobileOpen)}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 pt-24 pb-20 px-4 md:px-8 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
