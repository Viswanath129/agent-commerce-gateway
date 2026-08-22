import React from "react";
import { Button, SectionHeader, Badge } from "../components/ui/index.js";
import type { AuditBlock, AuditIntegrityResponse } from "../lib/api/types.js";

export interface AuditLedgerViewProps {
  blocks: AuditBlock[];
  integrity: AuditIntegrityResponse | null;
  isLoading: boolean;
  onVerifyIntegrity: () => Promise<void>;
  isVerifying: boolean;
}

export const AuditLedgerView: React.FC<AuditLedgerViewProps> = ({
  blocks,
  integrity,
  isLoading,
  onVerifyIntegrity,
  isVerifying,
}) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        eyebrow="CRYPTOGRAPHIC PROVENANCE"
        title="TAMPER-EVIDENT SHA-256 LEDGER"
        description="Backwards-chained non-repudiable audit logs guaranteeing execution provenance."
        action={
          <Button
            variant="outline"
            size="md"
            isLoading={isVerifying}
            onClick={onVerifyIntegrity}
            leftIcon={<span className="material-symbols-outlined text-[16px]">verified</span>}
          >
            Run Backend Verification
          </Button>
        }
      />

      {/* Integrity Status Card */}
      <div className="p-4 bg-surface-container-low border border-outline-variant/30 flex justify-between items-center text-xs font-mono-jb">
        <div>
          <span className="text-on-surface-variant">Ledger Chain Status: </span>
          <strong className={integrity?.isValid ? "text-secondary font-bold" : "text-error font-bold"}>
            {integrity?.isValid ? "INTEGRITY VERIFIED (VALID CHAIN)" : "TAMPER DETECTED"}
          </strong>
        </div>
        <div>
          <span className="text-on-surface-variant">Persisted Blocks: </span>
          <strong className="text-primary">{blocks.length}</strong>
        </div>
      </div>

      {/* Blocks Stream */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-xs font-mono-jb text-on-surface-variant">
            Loading real audit records...
          </div>
        ) : blocks.length === 0 ? (
          <div className="p-4 bg-surface-container-low border border-outline-variant/20 text-xs font-mono-jb text-on-surface-variant">
            No audit blocks committed yet.
          </div>
        ) : (
          blocks.slice(0, 15).map((b, idx) => (
            <div
              key={b.audit_id || idx}
              className="border border-outline-variant/30 bg-surface-container-lowest p-4 space-y-2 text-xs font-mono-jb"
            >
              <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
                <span className="text-primary font-bold">
                  BLOCK #{blocks.length - idx} &mdash; {b.event_type}
                </span>
                <Badge variant="success">VALIDATED</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-on-surface-variant block">Intent ID:</span>
                  <span className="text-on-surface truncate block">{b.intent_id}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Record Hash (SHA-256):</span>
                  <span className="text-primary truncate block">{b.record_hash}</span>
                </div>
                {b.previous_record_hash && (
                  <div className="md:col-span-2">
                    <span className="text-on-surface-variant block">Previous Block Hash:</span>
                    <span className="text-on-surface-variant/70 truncate block text-[11px]">
                      {b.previous_record_hash}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
