import React, { useState } from 'react';
import { SectionHeader } from '../../components/ui/SectionHeader.js';
import { Button } from '../../components/ui/Button.js';
import { formatTimestamp } from '../../lib/formatters/index.js';
import type { AuditBlock, AuditIntegrityResponse } from '../../types/index.js';

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
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <SectionHeader
        eyebrow="CRYPTOGRAPHIC PROVENANCE & FORENSICS"
        title="AUDIT LEDGER"
        description="TAMPER-EVIDENT TRANSACTION PROVENANCE. Every state transition is hashed using SHA-256 and backwards-chained to prevent retroactive tampering."
        action={
          <Button
            variant="glassProminent"
            size="md"
            isLoading={isVerifying}
            onClick={onVerifyIntegrity}
          >
            RUN BACKEND VERIFICATION
          </Button>
        }
      />

      {/* Integrity Banner */}
      <div className="relative overflow-hidden glass-panel rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                integrity?.isValid ? 'bg-[#6F9B83]' : 'bg-[#A76565]'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                integrity?.isValid ? 'bg-[#6F9B83]' : 'bg-[#A76565]'
              }`}
            />
          </span>
          <div>
            <span className="text-[#7A776F] uppercase text-[10px] tracking-wider block">LEDGER INTEGRITY STATE</span>
            <span className={`text-sm font-bold tracking-wide ${integrity?.isValid ? 'text-[#6F9B83]' : 'text-[#A76565]'}`}>
              {integrity?.isValid ? 'HASH CHAIN VALID' : 'TAMPER DETECTED'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-[11px] text-[#BCB7AB]">
          <div>
            <span className="text-[#7A776F] block uppercase text-[9px] tracking-wider">CHECKED BLOCKS</span>
            <span className="text-[#F4F0E6] font-bold">{integrity?.checkedBlocks ?? blocks.length}</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div>
            <span className="text-[#7A776F] block uppercase text-[9px] tracking-wider">ALGORITHM</span>
            <span className="text-[#C8B27A] font-semibold">SHA-256 CHAIN</span>
          </div>
        </div>
      </div>

      {/* Blocks Stream with Thin Vertical Line */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs font-mono">
          <span className="text-[#F4F0E6] font-semibold uppercase tracking-wider">PERSISTED HASH BLOCKS</span>
          <span className="text-[#7A776F] text-[11px]">Showing verified blocks</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-[#BCB7AB] glass-panel rounded-lg animate-pulse">
            VERIFYING AND LOADING PERSISTED AUDIT RECORDS...
          </div>
        ) : blocks.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-[#7A776F] glass-panel rounded-lg">
            NO AUDIT EVENTS RECORDED YET
          </div>
        ) : (
          <div className="relative pl-6 space-y-4">
            {/* Connecting Vertical Line with Glow */}
            <div className="absolute left-2.5 top-3 bottom-3 w-px bg-gradient-to-b from-[#C8B27A]/40 via-white/10 to-transparent shadow-[0_0_8px_rgba(200,178,122,0.2)]" />

            {blocks.slice(0, 20).map((b, idx) => {
              const blockNum = blocks.length - idx;
              return (
                <div key={b.audit_id || idx} className="relative group">
                  {/* Line Node Marker */}
                  <span className="absolute -left-[19px] top-5 w-2.5 h-2.5 rounded-full border border-[#C8B27A] bg-[#10100F] shadow-[0_0_8px_rgba(200,178,122,0.6)] group-hover:scale-125 transition-transform" />

                  <div className="relative overflow-hidden p-4 glass-panel glass-panel-interactive rounded-lg font-mono text-xs space-y-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[#C8B27A] font-bold text-xs tracking-wider">
                          BLOCK #{String(blockNum).padStart(3, '0')}
                        </span>
                        <span className="text-[#F4F0E6] uppercase font-semibold text-[11px] tracking-wide">
                          {b.event_type}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#7A776F]">
                        {formatTimestamp(b.timestamp)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] pt-1">
                      <div>
                        <span className="text-[#7A776F] block uppercase text-[10px]">Intent ID:</span>
                        <span className="text-[#F4F0E6] truncate block font-mono">{b.intent_id}</span>
                      </div>
                      <div>
                        <span className="text-[#7A776F] block uppercase text-[10px]">Block Decision:</span>
                        <span className="text-[#6F9B83] font-semibold">{b.new_state}</span>
                      </div>
                      <div className="group/hash">
                        <span className="text-[#7A776F] block uppercase text-[10px] flex items-center justify-between">
                          <span>Current Block Hash:</span>
                          <button
                            onClick={() => handleCopyHash(b.record_hash)}
                            className="text-[#C8B27A] hover:underline text-[9px] cursor-pointer"
                          >
                            {copiedHash === b.record_hash ? 'Copied!' : 'Copy'}
                          </button>
                        </span>
                        <span className="text-[#C8B27A] font-mono text-[10px] truncate block">
                          {b.record_hash}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#7A776F] block uppercase text-[10px]">Previous Block Hash:</span>
                        <span className="text-[#7A776F] font-mono text-[10px] truncate block">
                          {b.previous_record_hash || '0'.repeat(64)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
