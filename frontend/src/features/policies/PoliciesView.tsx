import React, { useState } from 'react';
import { SectionHeader } from '../../components/ui/SectionHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable.js';
import { formatInr, formatTimestamp } from '../../lib/formatters/index.js';
import type { MerchantPolicy, CatalogItem } from '../../types/index.js';

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
  const [newCapInput, setNewCapInput] = useState('2500');

  const handleSubmitMutation = async () => {
    const val = Number(newCapInput);
    if (isNaN(val) || val <= 0) return;
    await onUpdatePolicy(val);
    setShowMutationForm(false);
  };

  const catalogColumns: ColumnDef<CatalogItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (item) => <span className="text-[#C8B27A] font-mono text-xs font-semibold">{item.sku}</span>,
    },
    {
      key: 'name',
      header: 'ITEM NAME',
      render: (item) => <span className="text-[#F4F0E6] font-mono text-xs">{item.name}</span>,
    },
    {
      key: 'unit_price',
      header: 'UNIT PRICE',
      align: 'right',
      render: (item) => <span className="text-[#6F9B83] font-mono text-xs font-bold">{formatInr(item.unit_price, true)}</span>,
    },
    {
      key: 'available_stock',
      header: 'STOCK',
      align: 'right',
      render: (item) => <span className="text-[#BCB7AB] font-mono text-xs">{item.available_stock} units</span>,
    },
    {
      key: 'tax_rate_bps',
      header: 'TAX (GST)',
      align: 'right',
      render: (item) => <span className="text-[#7A776F] font-mono text-xs">{(item.tax_rate_bps / 100).toFixed(0)}%</span>,
    },
    {
      key: 'currency',
      header: 'CURRENCY',
      align: 'center',
      render: () => <span className="text-[#7A776F] font-mono text-[10px]">INR</span>,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Section Header */}
      <SectionHeader
        eyebrow="MERCHANT CONTROL BOUNDARY"
        title="POLICIES & COMMERCE TRUTH"
        description="Split enforcement boundary: Merchant-controlled operational DSL rules versus deterministic SQLite catalog ground truth."
        action={
          <Badge variant="accent" pulse>
            {policy ? policy.policy_version : 'pol_v1.0.0'} ACTIVE
          </Badge>
        }
      />

      {/* Split Layout: Merchant Policy vs Commerce Truth */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: MERCHANT POLICY (Editorial Rules Document) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="relative overflow-hidden glass-panel rounded-lg p-6 space-y-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            <div className="flex items-start justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="font-display text-xl text-[#F4F0E6] font-normal tracking-wide">
                  Merchant Policy Document
                </h3>
                <p className="text-xs font-mono text-[#BCB7AB] mt-0.5 font-light">
                  Immutable versioned policy governing autonomous transactions
                </p>
              </div>
              <Button
                variant={showMutationForm ? 'ghost' : 'glass'}
                size="xs"
                onClick={() => setShowMutationForm(!showMutationForm)}
              >
                {showMutationForm ? 'CANCEL' : 'MUTATE (PUT)'}
              </Button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {showMutationForm && (
                <div className="p-4 rounded-lg bg-[rgba(200,178,122,0.08)] border border-[#C8B27A]/40 space-y-3 backdrop-blur-md">
                  <span className="text-[#C8B27A] font-semibold block uppercase text-[11px] tracking-wider">
                    Draft Policy Mutation (Real Backend PUT)
                  </span>
                  <div>
                    <label className="text-[10px] text-[#7A776F] uppercase block mb-1 tracking-wider">
                      Max Single Transaction Limit (INR):
                    </label>
                    <input
                      type="number"
                      value={newCapInput}
                      onChange={(e) => setNewCapInput(e.target.value)}
                      className="w-full bg-[#10100F]/90 border border-white/10 rounded-md p-2.5 text-xs font-mono text-[#F4F0E6] focus:outline-none focus:border-[#C8B27A] focus:ring-1 focus:ring-[#C8B27A]/50 transition-all"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isUpdating}
                    onClick={handleSubmitMutation}
                    className="w-full"
                  >
                    CONFIRM & PERSIST TO pol_v2.0.0
                  </Button>
                </div>
              )}

              {isLoading || !policy ? (
                <div className="p-6 text-center text-[#7A776F]">Loading active merchant policy...</div>
              ) : (
                <div className="space-y-3 divide-y divide-white/[0.04]">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#7A776F] uppercase text-[10px] tracking-wider">POLICY VERSION:</span>
                    <span className="text-[#C8B27A] font-bold">{policy.policy_version}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#7A776F] uppercase text-[10px] tracking-wider">MERCHANT IDENTIFIER:</span>
                    <span className="text-[#F4F0E6]">{policy.merchant_id}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#7A776F] uppercase text-[10px] tracking-wider">MAX TRANSACTION AMOUNT:</span>
                    <span className="text-[#F4F0E6] font-bold">{formatInr(policy.max_transaction_amount, true)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#7A776F] uppercase text-[10px] tracking-wider">ALLOWED CATEGORIES:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {policy.allowed_categories.map((c) => (
                        <Badge key={c} variant="neutral" size="sm">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#7A776F] uppercase text-[10px] tracking-wider">AUTO REFUND ON FAILURE:</span>
                    <span className="text-[#6F9B83] font-semibold">ENABLED</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#7A776F] uppercase text-[10px] tracking-wider">EFFECTIVE TIMESTAMP:</span>
                    <span className="text-[#BCB7AB]">{formatTimestamp(policy.effective_at)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Adversarial Comparison Note */}
          <div className="relative overflow-hidden glass-panel-subtle rounded-lg p-5 space-y-2 font-mono text-xs border border-white/[0.06]">
            <div className="text-[#C8B27A] font-bold uppercase text-[11px] tracking-wider flex items-center gap-2">
              <span className="w-1 h-3 bg-[#C8B27A] rounded-full" />
              <span>GROUND TRUTH ENFORCEMENT PRINCIPLE</span>
            </div>
            <p className="text-[#BCB7AB] text-[11px] font-ui leading-relaxed font-light">
              When an autonomous agent generates a prompt asking for "Ergonomic Chair for ₹1.00", ACG completely ignores the agent-proposed price arithmetic. The control plane binds to the database catalog price (₹14,160.00) and computes taxes deterministically.
            </p>
          </div>
        </div>

        {/* RIGHT: COMMERCE TRUTH (Catalog & Price Grounding) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs font-mono">
            <span className="text-[#F4F0E6] font-semibold uppercase tracking-wider">
              AUTHORITATIVE CATALOG GROUND TRUTH
            </span>
            <span className="text-[#6F9B83] text-[11px] font-semibold">{catalog.length} ITEMS GROUNDED</span>
          </div>

          <DataTable
            columns={catalogColumns}
            data={catalog}
            isLoading={isLoading}
            emptyMessage="NO CATALOG ITEMS PERSISTED"
          />

          {/* Model Proposal vs Merchant Truth Comparison */}
          <div className="relative overflow-hidden glass-panel rounded-lg p-5 space-y-3 font-mono text-xs shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            <div className="text-xs font-bold text-[#F4F0E6] uppercase tracking-wider border-b border-white/[0.06] pb-2">
              AGENT PROPOSAL VS. MERCHANT TRUTH COMPARISON
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3.5 rounded-lg bg-[#A76565]/15 border border-[#A76565]/40 space-y-1.5 shadow-[0_4px_12px_rgba(167,101,101,0.15)]">
                <span className="text-[#A76565] font-bold block uppercase text-[10px] tracking-wider">
                  AGENT PROPOSAL (PROBABILISTIC)
                </span>
                <div className="text-[#F4F0E6]">SKU: SKU-CHAIR-ERGO</div>
                <div className="text-[#BCB7AB]">Hallucinated Price: ₹1.00</div>
                <div className="text-[#A76565] font-semibold text-[10px] uppercase pt-1 border-t border-[#A76565]/20">
                  REJECTED AS ZERO AUTHORITY
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#6F9B83]/15 border border-[#6F9B83]/40 space-y-1.5 shadow-[0_4px_12px_rgba(111,155,131,0.15)]">
                <span className="text-[#6F9B83] font-bold block uppercase text-[10px] tracking-wider">
                  MERCHANT TRUTH (DETERMINISTIC)
                </span>
                <div className="text-[#F4F0E6]">SKU: SKU-CHAIR-ERGO</div>
                <div className="text-[#BCB7AB]">Catalog Price: ₹12,000.00 + 18% GST = ₹14,160.00</div>
                <div className="text-[#6F9B83] font-semibold text-[10px] uppercase pt-1 border-t border-[#6F9B83]/20">
                  BOUND TO AUTHORIZED CHECKOUT
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
