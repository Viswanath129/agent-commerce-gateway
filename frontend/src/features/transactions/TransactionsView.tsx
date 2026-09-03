import React, { useState } from 'react';
import { SectionHeader } from '../../components/ui/SectionHeader.js';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable.js';
import { Badge } from '../../components/ui/Badge.js';
import { Timeline, type TimelineStepItem } from '../../components/ui/Timeline.js';
import { CodeBlock } from '../../components/ui/CodeBlock.js';
import { Button } from '../../components/ui/Button.js';
import { formatInr, formatTimestamp, formatTimeOnly } from '../../lib/formatters/index.js';
import type { OrderSession, TransactionDetailResponse } from '../../types/index.js';

export interface TransactionsViewProps {
  transactions: OrderSession[];
  selectedDetail: TransactionDetailResponse | null;
  isLoading: boolean;
  onSelectTransaction: (intentId: string) => void;
  onBackToList: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  selectedDetail,
  isLoading,
  onSelectTransaction,
  onBackToList,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const session = selectedDetail?.session;
  const trajectory = selectedDetail?.trajectory || [];

  // Table Columns for Master List View
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
      key: 'agent',
      header: 'AGENT',
      render: (tx) => (
        <span className="text-[#F4F0E6] font-mono text-xs">
          {tx.mandate_id ? 'agent_claude_sonnet' : 'native_agent_01'}
        </span>
      ),
    },
    {
      key: 'intent_id',
      header: 'INTENT ID',
      render: (tx) => (
        <div className="flex items-center gap-1.5 group/item">
          <span className="text-[#C8B27A] font-mono text-xs truncate block max-w-[150px] group-hover/item:text-[#E4D5B0]">
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
      key: 'amount',
      header: 'AMOUNT',
      align: 'right',
      render: (tx) => (
        <span className="text-[#F4F0E6] font-mono text-xs font-semibold">
          {formatInr(tx.amount, true)}
        </span>
      ),
    },
    {
      key: 'policy',
      header: 'POLICY',
      render: () => <span className="text-[#BCB7AB] font-mono text-xs">pol_v1.0.0</span>,
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
      header: 'STATUS',
      align: 'right',
      render: (tx) => {
        const isSuccess = tx.status === 'ORDER_CREATED' || tx.status === 'PAYMENT_CAPTURED';
        const isRefund = tx.status === 'REFUNDED';
        const variant = isSuccess ? 'success' : isRefund ? 'reconciliation' : 'danger';
        return <Badge variant={variant} size="sm" pulse={isSuccess}>{tx.status}</Badge>;
      },
    },
  ];

  const timelineSteps: TimelineStepItem[] = trajectory.map((step, idx) => ({
    id: step.audit_id || idx,
    timestamp: step.timestamp,
    eventType: step.event_type,
    title: `${step.event_type.replace(/_/g, ' ')}`,
    description: `State transition: ${step.previous_state || 'INIT'} → ${step.new_state}`,
    status: step.event_type.includes('FAIL') || step.event_type.includes('REJECT') ? 'FAILED' : 'SUCCESS',
    hash: step.record_hash,
  }));

  // DETAIL VIEW
  if (selectedDetail && session) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Back Button */}
        <Button
          variant="glass"
          size="sm"
          onClick={onBackToList}
          leftIcon={<span className="text-sm mr-1">←</span>}
        >
          BACK TO TRANSACTIONS LIST
        </Button>

        {/* Transaction Header Card */}
        <div className="relative overflow-hidden glass-panel rounded-lg p-6 flex flex-col md:flex-row md:items-end justify-between gap-6 border border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#C8B27A] uppercase tracking-widest font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8B27A] shadow-[0_0_8px_rgba(200,178,122,0.6)]" />
              <span>TRANSACTION RECORD</span>
            </div>
            <h1 className="font-mono text-2xl md:text-3xl text-[#F4F0E6] font-bold tracking-tight">
              {session.intent_id}
            </h1>
            <div className="flex items-center gap-4 text-xs font-mono text-[#BCB7AB]">
              <span>Created: {formatTimestamp(session.created_at)}</span>
              <span className="text-white/20">•</span>
              <span>Reservation: {session.reservation_id}</span>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            <span className="font-mono text-[10px] text-[#7A776F] uppercase tracking-wider">
              AUTHORIZED TRANSACTION AMOUNT
            </span>
            <div className="font-display text-4xl md:text-5xl text-[#C8B27A] font-semibold">
              {formatInr(session.amount, true)}
            </div>
            <Badge variant="success" size="md" pulse>{session.status}</Badge>
          </div>
        </div>

        {/* Decision Trajectory */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Decision Timeline */}
          <div className="lg:col-span-7 space-y-4">
            <div className="border-b border-white/[0.08] pb-3 flex items-center justify-between">
              <h3 className="font-display text-xl text-[#F4F0E6] tracking-wide">
                Editorial Decision Timeline (9 Stages)
              </h3>
              <span className="text-xs font-mono text-[#7A776F]">
                {timelineSteps.length} audit steps verified
              </span>
            </div>

            <Timeline steps={timelineSteps} />
          </div>

          {/* Right Column: Technical Forensics & JSON */}
          <div className="lg:col-span-5 space-y-6">
            <div className="relative overflow-hidden glass-panel rounded-lg p-5 space-y-3 font-mono text-xs shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

              <div className="text-xs font-bold text-[#F4F0E6] uppercase tracking-wider border-b border-white/[0.06] pb-2">
                Session Parameters
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-[#7A776F]">Intent ID:</span>
                  <span className="text-[#C8B27A] truncate max-w-[200px] font-semibold">{session.intent_id}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-[#7A776F]">Receipt (Idempotency):</span>
                  <span className="text-[#F4F0E6] truncate max-w-[200px]">{session.receipt}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-[#7A776F]">Razorpay Order ID:</span>
                  <span className="text-[#F4F0E6] font-bold">{session.razorpay_order_id || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-[#7A776F]">Reservation ID:</span>
                  <span className="text-[#BCB7AB]">{session.reservation_id}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-[#7A776F]">Settlement Currency:</span>
                  <span className="text-[#F4F0E6]">INR (₹)</span>
                </div>
              </div>
            </div>

            <CodeBlock
              title="Authoritative Database Record"
              language="json"
              code={JSON.stringify(selectedDetail, null, 2)}
            />
          </div>
        </div>
      </div>
    );
  }

  // MASTER LIST VIEW
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="PERSISTED TRANSACTION REGISTRY"
        title="TRANSACTIONS"
        description="Immutable record of AI-originated transactions authorized by ACG and executed on Razorpay rails."
      />

      <DataTable
        columns={columns}
        data={transactions}
        isLoading={isLoading}
        emptyMessage="NO TRANSACTIONS YET"
        onRowClick={(tx) => onSelectTransaction(tx.intent_id)}
      />
    </div>
  );
};
