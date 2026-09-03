import React, { useState } from 'react';
import { SectionHeader } from '../../components/ui/SectionHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { formatInr, truncateHash } from '../../lib/formatters/index.js';
import type { BuyerMandate, RevokedMandate } from '../../types/index.js';

export interface MandatesViewProps {
  mandates: BuyerMandate[];
  revoked: RevokedMandate[];
  isLoading: boolean;
  onRevokeMandate: (mandateId: string) => Promise<void>;
  isRevoking: boolean;
}

export const MandatesView: React.FC<MandatesViewProps> = ({
  mandates,
  revoked,
  isLoading,
  onRevokeMandate,
  isRevoking,
}) => {
  const [selectedMandateId, setSelectedMandateId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenRevokeModal = (mandateId: string) => {
    setSelectedMandateId(mandateId);
    setIsModalOpen(true);
  };

  const handleConfirmRevocation = async () => {
    if (!selectedMandateId) return;
    await onRevokeMandate(selectedMandateId);
    setIsModalOpen(false);
    setSelectedMandateId(null);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <SectionHeader
        eyebrow="CRYPTOGRAPHIC BUYER DELEGATION"
        title="SPEND MANDATES"
        description="Noble Ed25519 asymmetric cryptographic authority contracts. AI agents cannot spend without a valid, non-revoked principal delegation."
        action={<Badge variant="accent" pulse>Ed25519 VERIFIED</Badge>}
      />

      {/* Grid of Mandate Authority Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Mandates */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs font-mono">
            <span className="text-[#F4F0E6] font-semibold uppercase tracking-wider">ACTIVE MANDATE CONTRACTS</span>
            <span className="text-[#6F9B83] text-[11px] font-semibold">{mandates.length} ACTIVE</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs font-mono text-[#BCB7AB] glass-panel rounded-lg animate-pulse">
              QUERYING BUYER MANDATE REGISTRY...
            </div>
          ) : mandates.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#7A776F] glass-panel rounded-lg">
              NO ACTIVE BUYER MANDATES
            </div>
          ) : (
            mandates.map((m) => {
              const isRevoked = revoked.some((r) => r.mandate_id === m.mandate_id);
              const remainingPaise = m.remaining_budget !== undefined ? m.remaining_budget : m.budget_limit;
              const usedPaise = m.budget_limit - remainingPaise;
              const pctUsed = Math.min(100, (usedPaise / m.budget_limit) * 100);

              return (
                <div
                  key={m.mandate_id}
                  className="relative overflow-hidden glass-panel rounded-lg p-5 space-y-4 font-mono text-xs shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                >
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

                  <div className="flex items-start justify-between border-b border-white/[0.06] pb-3">
                    <div>
                      <span className="text-[10px] text-[#7A776F] uppercase tracking-wider block">
                        MANDATE IDENTIFIER
                      </span>
                      <h4 className="text-sm font-bold text-[#C8B27A] mt-0.5">{m.mandate_id}</h4>
                    </div>
                    <Badge variant={isRevoked ? 'danger' : 'success'} size="sm" pulse={!isRevoked}>
                      {isRevoked ? 'REVOKED' : 'ACTIVE'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div>
                      <span className="text-[#7A776F] block uppercase text-[10px]">Maximum Limit:</span>
                      <span className="text-[#F4F0E6] font-semibold">{formatInr(m.budget_limit, true)}</span>
                    </div>
                    <div>
                      <span className="text-[#7A776F] block uppercase text-[10px]">Remaining Balance:</span>
                      <span className="text-[#6F9B83] font-bold">{formatInr(remainingPaise, true)}</span>
                    </div>
                    <div>
                      <span className="text-[#7A776F] block uppercase text-[10px]">Principal Key:</span>
                      <span className="text-[#BCB7AB] truncate block font-mono">{truncateHash(m.principal_public_key, 6, 6)}</span>
                    </div>
                    <div>
                      <span className="text-[#7A776F] block uppercase text-[10px]">Signature:</span>
                      <span className="text-[#6F9B83] font-semibold">VERIFIED</span>
                    </div>
                  </div>

                  {/* Budget Utilization Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] text-[#7A776F]">
                      <span className="tracking-wider">BUDGET CONSUMED</span>
                      <span className="font-semibold text-[#BCB7AB]">{pctUsed.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1C1C19] rounded-full overflow-hidden border border-white/[0.04]">
                      <div
                        className="h-full bg-gradient-to-r from-[#C8B27A] to-[#E4D5B0] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(200,178,122,0.4)]"
                        style={{ width: `${pctUsed}%` }}
                      />
                    </div>
                  </div>

                  {/* Revoke Button */}
                  {!isRevoked && (
                    <div className="pt-2 border-t border-white/[0.04] flex justify-end">
                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => handleOpenRevokeModal(m.mandate_id)}
                      >
                        REVOKE MANDATE
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Revoked Mandates Registry */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs font-mono">
            <span className="text-[#F4F0E6] font-semibold uppercase tracking-wider">REVOCATION REGISTRY</span>
            <span className="text-[#A76565] text-[11px] font-semibold">{revoked.length} REVOKED</span>
          </div>

          {revoked.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#7A776F] glass-panel rounded-lg">
              NO REVOKED MANDATES
            </div>
          ) : (
            revoked.map((r) => (
              <div
                key={r.mandate_id}
                className="relative overflow-hidden glass-panel border-[#A76565]/40 bg-[#A76565]/5 rounded-lg p-4 space-y-2 font-mono text-xs shadow-[0_4px_16px_rgba(167,101,101,0.15)]"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#A76565]/30 to-transparent pointer-events-none" />

                <div className="flex items-center justify-between border-b border-[#A76565]/20 pb-2">
                  <span className="text-[#A76565] font-bold">{r.mandate_id}</span>
                  <Badge variant="danger" size="sm">REVOKED</Badge>
                </div>
                <div className="text-[11px] text-[#BCB7AB]">
                  <span className="text-[#7A776F] block uppercase text-[10px]">Reason:</span>
                  {r.revocation_reason}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Revocation Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="CONFIRM MANDATE REVOCATION"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              CANCEL
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isRevoking}
              onClick={handleConfirmRevocation}
            >
              CONFIRM REVOCATION
            </Button>
          </>
        }
      >
        <div className="space-y-3 font-mono text-xs text-[#BCB7AB]">
          <p>
            Are you sure you want to revoke mandate <strong className="text-[#F4F0E6]">{selectedMandateId}</strong>?
          </p>
          <p className="text-[#A76565] font-semibold text-[11px] leading-relaxed">
            This writes directly to the control plane database. Subsequent checkout attempts using this mandate will be intercepted with HTTP 403 MANDATE_REVOKED.
          </p>
        </div>
      </Modal>
    </div>
  );
};
