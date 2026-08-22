import React, { useState } from "react";
import { Button, SectionHeader, Badge, Panel } from "../components/ui/index.js";
import type { BuyerMandate, RevokedMandate } from "../lib/api/types.js";

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
  const [mandateIdInput, setMandateIdInput] = useState("");

  const handleRevoke = async () => {
    if (!mandateIdInput.trim()) return;
    await onRevokeMandate(mandateIdInput.trim());
    setMandateIdInput("");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        eyebrow="CRYPTOGRAPHIC BUYER DELEGATIONS"
        title="AUTHORITY MANDATE REGISTRY"
        description="Noble Ed25519 asymmetric signature delegations with dynamic revocation enforcement."
        action={<Badge variant="success">Noble Ed25519 Active</Badge>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Active Mandates */}
        <div className="space-y-4">
          <h3 className="font-bodoni text-xl text-on-surface border-b border-outline-variant/20 pb-2">
            Active Buyer Mandates
          </h3>

          {isLoading ? (
            <div className="p-8 text-center text-xs font-mono-jb text-on-surface-variant">Loading mandates...</div>
          ) : mandates.length === 0 ? (
            <div className="p-4 bg-surface-container-low border border-outline-variant/20 text-xs font-mono-jb text-on-surface-variant">
              No active buyer mandates persisted.
            </div>
          ) : (
            mandates.map((m) => (
              <div
                key={m.mandate_id}
                onClick={() => setMandateIdInput(m.mandate_id)}
                className="border border-outline-variant/30 bg-surface-container-lowest p-5 space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
                title="Click to select for Revocation"
              >
                <div className="flex justify-between items-start border-b border-outline-variant/20 pb-2">
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase block">
                      MANDATE ID (Click to select)
                    </span>
                    <h4 className="text-primary font-bold">{m.mandate_id}</h4>
                  </div>
                  <Badge variant="success">ACTIVE</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono-jb">
                  <div>
                    <span className="text-on-surface-variant block">Budget Limit:</span>
                    <strong className="text-primary">₹{(m.budget_limit / 100).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block">Remaining:</span>
                    <strong className="text-secondary">₹{(m.remaining_budget / 100).toFixed(2)}</strong>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, ((m.budget_limit - m.remaining_budget) / m.budget_limit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Revocation Console */}
        <Panel
          title="Instant Mandate Revocation"
          subtitle="Principals can revoke delegation at any moment. Subsequent checkouts are immediately blocked (HTTP 403)."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-mono-jb text-on-surface-variant uppercase block">
                Target Mandate ID:
              </label>
              <input
                type="text"
                value={mandateIdInput}
                onChange={(e) => setMandateIdInput(e.target.value)}
                placeholder="Enter Mandate ID (e.g. man_pentest_...)"
                className="w-full bg-surface-container-low border border-outline-variant/40 p-2 text-xs font-mono-jb text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <Button
              variant="danger"
              size="md"
              isLoading={isRevoking}
              onClick={handleRevoke}
              className="w-full"
            >
              Revoke Mandate in DB
            </Button>

            <div className="border-t border-outline-variant/20 pt-4 mt-6">
              <h4 className="text-xs font-mono-jb text-on-surface-variant uppercase mb-3 font-semibold">
                Revoked Mandates Registry:
              </h4>
              <div className="space-y-2 text-xs font-mono-jb max-h-56 overflow-y-auto">
                {revoked.length === 0 ? (
                  <div className="text-on-surface-variant">No revoked mandates recorded.</div>
                ) : (
                  revoked.map((r) => (
                    <div
                      key={r.mandate_id}
                      className="p-2.5 bg-surface-container-low border border-error/20 flex justify-between items-center"
                    >
                      <div>
                        <span className="text-error font-bold block">{r.mandate_id}</span>
                        <span className="text-[10px] text-on-surface-variant">{r.revocation_reason}</span>
                      </div>
                      <Badge variant="error">REVOKED</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
