import React from "react";

export type TabId =
  | "overview"
  | "live-demo"
  | "transactions"
  | "mandates"
  | "policies"
  | "reservations"
  | "audit-ledger"
  | "system-health";

interface NavItemDef {
  id: TabId;
  num: string;
  label: string;
  badge?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "overview", num: "01", label: "Overview" },
  { id: "live-demo", num: "02", label: "Live Demo", badge: "Interactive" },
  { id: "transactions", num: "03", label: "Transactions" },
  { id: "mandates", num: "04", label: "Mandates & Authority" },
  { id: "policies", num: "05", label: "Policies & Truth" },
  { id: "reservations", num: "06", label: "Atomic Reservations" },
  { id: "audit-ledger", num: "07", label: "Audit Ledger" },
  { id: "system-health", num: "08", label: "System Health" },
];

export interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  merchantId?: string;
  policyVersion?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  merchantId = "merch_acme_electronics_01",
  policyVersion = "pol_v1.0.0",
}) => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-surface-container-lowest flex flex-col border-r border-outline-variant/30 z-50">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 text-primary border-b border-outline-variant/20">
        <span className="material-symbols-outlined font-bold text-2xl">token</span>
        <div className="flex flex-col">
          <span className="font-bodoni text-xl tracking-wider uppercase font-semibold">ACG CORE</span>
          <span className="text-[10px] font-mono-jb text-primary/60 tracking-widest uppercase">
            Razorpay Control Plane
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all text-left border-l-[3px] ${
                isActive
                  ? "text-primary font-medium border-primary bg-surface-container-high/40"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/30 border-transparent"
              }`}
            >
              <span className={`text-xs font-mono-jb w-5 ${isActive ? "text-primary/60" : "text-on-surface-variant/50"}`}>
                {item.num}
              </span>
              <span className="tracking-wide flex-1 flex items-center justify-between">
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 border border-primary/30 uppercase font-mono-jb">
                    {item.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Status Box */}
      <div className="mt-auto border-t border-outline-variant/30 p-4 space-y-2 bg-surface-container-lowest">
        <div className="flex items-center justify-between text-xs font-mono-jb text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" /> LIVE DB CONNECTED
          </span>
          <span className="text-[10px] text-primary">REAL-TIME</span>
        </div>
        <div className="flex flex-col gap-0.5 text-xs font-mono-jb">
          <span className="text-[10px] text-on-surface-variant/60 uppercase">Active Merchant</span>
          <span className="text-primary truncate">{merchantId}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-xs font-mono-jb pt-1 border-t border-outline-variant/20">
          <span className="text-[10px] text-on-surface-variant/60 uppercase">Active Policy</span>
          <span className="text-secondary font-mono-jb">{policyVersion}</span>
        </div>
      </div>
    </aside>
  );
};
