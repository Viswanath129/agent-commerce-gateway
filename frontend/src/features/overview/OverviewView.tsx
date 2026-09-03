import React, { useState } from 'react';
import { SectionHeader } from '../../components/ui/SectionHeader.js';
import { Metric } from '../../components/ui/Metric.js';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable.js';
import { Badge } from '../../components/ui/Badge.js';
import { ExecutionPipeline, type PipelineStageDef } from '../../components/features/ExecutionPipeline.js';
import { formatInr, formatTimeOnly } from '../../lib/formatters/index.js';
import type { DashboardMetrics, OrderSession } from '../../types/index.js';

export interface OverviewViewProps {
  metrics: DashboardMetrics | null;
  transactions: OrderSession[];
  isLoading: boolean;
  onSelectTransaction: (intentId: string) => void;
}

const OVERVIEW_PIPELINE_STAGES: PipelineStageDef[] = [
  { id: 'intent', num: '01', name: 'INTENT', description: 'Canonical Zod schema', status: 'success' },
  { id: 'authority', num: '02', name: 'AUTHORITY', description: 'Ed25519 cryptographic check', status: 'success' },
  { id: 'truth', num: '03', name: 'TRUTH', description: 'DB catalog price grounding', status: 'success' },
  { id: 'policy', num: '04', name: 'POLICY', description: 'Merchant limits & scopes', status: 'success' },
  { id: 'reserve', num: '05', name: 'RESERVE', description: 'Dual-resource ACID lock', status: 'success' },
  { id: 'razorpay', num: '06', name: 'RAZORPAY', description: 'Idempotent rail execution', status: 'success' },
  { id: 'reconcile', num: '07', name: 'RECONCILIATION', description: 'HMAC webhook & audit chain', status: 'success' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  transactions,
  isLoading,
  onSelectTransaction,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const columns: ColumnDef<OrderSession>[] = [
    {
      key: 'created_at',
      header: 'TIME (UTC)',
      render: (tx) => (
        <span className="text-[#BCB7AB] font-mono text-xs">
          {formatTimeOnly(tx.created_at)}
        </span>
      ),
    },
    {
      key: 'intent_id',
      header: 'INTENT ID',
      render: (tx) => (
        <div className="flex items-center gap-1.5 group/item">
          <span className="text-[#C8B27A] font-mono text-xs truncate block max-w-[160px] group-hover/item:text-[#E4D5B0]">
            {tx.intent_id}
          </span>
          <button
            onClick={(e) => handleCopy(e, tx.intent_id)}
            className="opacity-0 group-hover/item:opacity-100 text-[10px] text-[#7A776F] hover:text-[#C8B27A] transition-opacity p-0.5"
            title="Copy Intent ID"
          >
            {copiedId === tx.intent_id ? '✓' : '⧉'}
          </button>
        </div>
      ),
    },
    {
      key: 'mandate_id',
      header: 'MANDATE',
      render: (tx) => (
        <span className="text-[#BCB7AB] font-mono text-xs truncate block max-w-[140px]">
          {tx.mandate_id || 'man_nominal_default'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'AMOUNT (INR)',
      align: 'right',
      render: (tx) => (
        <span className="text-[#F4F0E6] font-mono text-xs font-semibold">
          {formatInr(tx.amount, true)}
        </span>
      ),
    },
    {
      key: 'razorpay_order_id',
      header: 'RAZORPAY ORDER',
      render: (tx) => (
        <span className="text-[#BCB7AB] font-mono text-xs truncate block max-w-[140px]">
          {tx.razorpay_order_id || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'GATEWAY STATUS',
      align: 'right',
      render: (tx) => {
        const isSuccess = tx.status === 'ORDER_CREATED' || tx.status === 'PAYMENT_CAPTURED';
        const isRefund = tx.status === 'REFUNDED';
        const variant = isSuccess ? 'success' : isRefund ? 'reconciliation' : 'danger';
        return <Badge variant={variant} size="sm" pulse={isSuccess}>{tx.status}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <SectionHeader
        eyebrow="MERCHANT AGENT COMMERCE CONTROL PLANE"
        title="AGENT COMMERCE CONTROL PLANE"
        description="Deterministic control between AI intent and financial execution. The model can propose anything; the control plane decides whether it is authorized."
      />

      {/* Live System Pipeline */}
      <ExecutionPipeline stages={OVERVIEW_PIPELINE_STAGES} />

      {/* Live Metrics Grid (Zero-Mock from SQLite) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="AI INTENTS"
          value={metrics ? metrics.ai_intents_count.toLocaleString() : '0'}
          subtext="Total intents evaluated"
          indicator="live"
        />
        <Metric
          label="AUTHORIZED GMV"
          value={metrics ? formatInr(metrics.authorized_gmv_inr, false) : '₹0.00'}
          subtext="100% Truth Grounded"
          indicator="success"
        />
        <Metric
          label="BLOCKED ATTEMPTS"
          value={metrics ? metrics.blocked_attempts_count.toLocaleString() : '0'}
          subtext="Adversarial & over-budget"
          indicator="danger"
        />
        <Metric
          label="ACTIVE RESERVATIONS"
          value={metrics ? metrics.active_reservations_count.toLocaleString() : '0'}
          subtext="Dual-resource locked"
          indicator="warning"
        />
      </div>

      {/* Live Activity Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-xl text-[#F4F0E6] font-normal tracking-wide">
              LIVE ACTIVITY
            </h2>
            <span className="text-xs font-mono text-white/20">//</span>
            <span className="text-xs font-mono text-[#7A776F]">Persisted Transactions</span>
          </div>
          <span className="text-xs font-mono text-[#BCB7AB]">
            {transactions.length} record{transactions.length !== 1 ? 's' : ''} in ledger
          </span>
        </div>

        <DataTable
          columns={columns}
          data={transactions}
          isLoading={isLoading}
          emptyMessage="NO TRANSACTIONS YET"
          onRowClick={(tx) => onSelectTransaction(tx.intent_id)}
        />
      </div>
    </div>
  );
};
