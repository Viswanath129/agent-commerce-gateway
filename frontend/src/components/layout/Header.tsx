import React from "react";
import { Badge, Button } from "../ui/index.js";

export interface HeaderProps {
  tenantName?: string;
  isSyncing?: boolean;
  onSync: () => void;
  syncTimestamp?: string;
}

export const Header: React.FC<HeaderProps> = ({
  tenantName = "ACME_ELECTRONICS",
  isSyncing = false,
  onSync,
  syncTimestamp,
}) => {
  return (
    <header className="fixed top-0 left-[280px] right-0 h-16 bg-background/95 backdrop-blur-md z-40 px-8 flex items-center justify-between border-b border-outline-variant/20">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs font-mono-jb text-on-surface-variant">
          <span className="text-primary font-bold">MODE:</span>{" "}
          <span className="text-secondary font-bold">SANDBOX / LIVE BACKEND</span>
        </div>
        <div className="w-px h-4 bg-outline-variant/30" />
        <div className="flex items-center gap-2 text-xs font-mono-jb text-on-surface-variant">
          <span className="text-primary font-bold">TENANT:</span>{" "}
          <span>{tenantName}</span>
        </div>
        <div className="w-px h-4 bg-outline-variant/30" />
        <div className="flex items-center gap-2 text-xs font-mono-jb text-secondary">
          <span className="material-symbols-outlined text-[14px]">bolt</span> RAILS: RAZORPAY TEST/SANDBOX
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="success" dot size="md">
          ZERO-MOCK ACTIVE
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          isLoading={isSyncing}
          onClick={onSync}
          leftIcon={<span className="material-symbols-outlined text-[14px]">refresh</span>}
        >
          {syncTimestamp ? `SYNCED (${syncTimestamp})` : "SYNC"}
        </Button>
      </div>
    </header>
  );
};
