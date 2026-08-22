import React from "react";
import { Sidebar, type TabId } from "./Sidebar.js";
import { Header } from "./Header.js";

export interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  merchantId?: string;
  policyVersion?: string;
  isSyncing?: boolean;
  onSync: () => void;
  syncTimestamp?: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  merchantId,
  policyVersion,
  isSyncing,
  onSync,
  syncTimestamp,
  children,
}) => {
  return (
    <div className="min-h-screen bg-background text-on-background antialiased selection:bg-primary selection:text-on-primary">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        merchantId={merchantId}
        policyVersion={policyVersion}
      />
      <div className="pl-[280px]">
        <Header
          tenantName={merchantId?.toUpperCase()}
          isSyncing={isSyncing}
          onSync={onSync}
          syncTimestamp={syncTimestamp}
        />
        <main className="pt-16 min-h-screen bg-background p-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
