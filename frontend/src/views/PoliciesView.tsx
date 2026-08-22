import React, { useState } from "react";
import { Button, SectionHeader, Badge, Panel } from "../components/ui/index.js";
import type { MerchantPolicy, CatalogItem } from "../lib/api/types.js";

export interface PoliciesViewProps {
  policy: MerchantPolicy | null;
  catalog: CatalogItem[];
  isLoading: boolean;
  onUpdatePolicy: (newCapInr: number) => Promise<void>;
  isUpdating: boolean;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policy,
  catalog,
  isLoading,
  onUpdatePolicy,
  isUpdating,
}) => {
  const [showMutationForm, setShowMutationForm] = useState(false);
  const [newCapInput, setNewCapInput] = useState("1500");

  const handleSubmitMutation = async () => {
    const capNum = Number(newCapInput);
    if (isNaN(capNum) || capNum <= 0) return;
    await onUpdatePolicy(capNum);
    setShowMutationForm(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        eyebrow="MERCHANT CONFIGURATION DOCUMENT"
        title="POLICY & GROUND TRUTH ENGINE"
        description="Versioned merchant policy boundaries and direct SQLite catalog price grounding."
        action={
          <Badge variant="gold">
            {policy ? `${policy.policy_version} (ACTIVE)` : "pol_v1.0.0"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Policy DSL */}
        <Panel
          title={<span className="italic">I. Transaction Limits & Rules</span>}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMutationForm(!showMutationForm)}
            >
              Mutate Policy (PUT)
            </Button>
          }
        >
          <div className="space-y-4">
            {showMutationForm && (
              <div className="p-4 bg-surface-container-low border border-primary/40 space-y-3 animate-fadeIn">
                <span className="text-xs text-primary font-bold uppercase block">
                  Draft Real Merchant Policy Update
                </span>
                <div>
                  <label className="text-[10px] text-on-surface-variant uppercase block">
                    Max Single Ticket Cap (INR):
                  </label>
                  <input
                    type="number"
                    value={newCapInput}
                    onChange={(e) => setNewCapInput(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/40 p-1.5 text-xs font-mono-jb text-on-surface mt-1 focus:border-primary focus:outline-none"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isUpdating}
                  onClick={handleSubmitMutation}
                  className="w-full"
                >
                  Persist Policy Update
                </Button>
              </div>
            )}

            {isLoading || !policy ? (
              <div className="text-xs font-mono-jb text-on-surface-variant">Loading active policy...</div>
            ) : (
              <div className="space-y-3 text-xs font-mono-jb">
                <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant">Policy Version</span>
                  <span className="text-primary font-bold">{policy.policy_version}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant">Merchant ID</span>
                  <span className="text-on-surface font-bold">{policy.merchant_id}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant">Max Single Ticket Limit</span>
                  <span className="text-on-surface font-bold">
                    ₹{(policy.max_transaction_amount / 100).toFixed(2)} INR
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant">Allowed Categories</span>
                  <span className="text-secondary font-bold">{policy.allowed_categories.join(", ")}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant">Auto-Refund on Warehouse Stockout</span>
                  <span className="text-secondary font-bold">
                    {policy.auto_refund_on_fulfillment_failure ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Right Column: Catalog Truth */}
        <Panel title={<span className="italic">II. Merchant Catalog Truth (SQLite Grounding)</span>}>
          <div className="space-y-3 text-xs font-mono-jb">
            {isLoading ? (
              <div className="text-on-surface-variant">Loading catalog items...</div>
            ) : catalog.length === 0 ? (
              <div className="text-on-surface-variant">No active catalog items.</div>
            ) : (
              catalog.map((i) => (
                <div
                  key={i.sku}
                  className="p-3 bg-surface-container-low border border-outline-variant/20 flex justify-between items-center"
                >
                  <div>
                    <div className="text-primary font-bold">{i.sku}</div>
                    <div className="text-[11px] text-on-surface-variant">
                      {i.name} ({i.category})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-on-surface font-bold">₹{(i.unit_price / 100).toFixed(2)}</div>
                    <div className="text-[10px] text-secondary">Stock: {i.available_stock} units</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
};
