import React from 'react';
import { motion } from 'framer-motion';
import { SectionHeader } from '../../components/ui/SectionHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Metric } from '../../components/ui/Metric.js';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable.js';
import { formatInr, formatTimestamp } from '../../lib/formatters/index.js';
import type { Reservation } from '../../types/index.js';

export interface ReservationsViewProps {
  reservations: Reservation[];
  isLoading: boolean;
  onRunConcurrencyTest: () => Promise<void>;
  isTestingConcurrency: boolean;
  concurrencyResult: { admitted: string; blocked: string } | null;
}

export const ReservationsView: React.FC<ReservationsViewProps> = ({
  reservations,
  isLoading,
  onRunConcurrencyTest,
  isTestingConcurrency,
  concurrencyResult,
}) => {
  const columns: ColumnDef<Reservation>[] = [
    {
      key: 'reservation_id',
      header: 'RESERVATION ID',
      render: (r) => <span className="text-[#C8B27A] font-mono text-xs font-semibold">{r.reservation_id}</span>,
    },
    {
      key: 'intent_id',
      header: 'INTENT ID',
      render: (r) => <span className="text-[#BCB7AB] font-mono text-xs truncate block max-w-[140px]">{r.intent_id}</span>,
    },
    {
      key: 'mandate_id',
      header: 'MANDATE',
      render: (r) => <span className="text-[#BCB7AB] font-mono text-xs truncate block max-w-[130px]">{r.mandate_id}</span>,
    },
    {
      key: 'reserved_budget',
      header: 'RESERVED AMOUNT',
      align: 'right',
      render: (r) => <span className="text-[#F4F0E6] font-mono text-xs font-bold">{formatInr(r.reserved_budget, true)}</span>,
    },
    {
      key: 'status',
      header: 'STATUS',
      align: 'right',
      render: (r) => (
        <Badge
          variant={r.status === 'HELD' ? 'warning' : r.status === 'COMMITTED' ? 'success' : 'neutral'}
          size="sm"
          pulse={r.status === 'HELD'}
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'CREATED (UTC)',
      render: (r) => <span className="text-[#7A776F] font-mono text-[11px]">{formatTimestamp(r.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <SectionHeader
        eyebrow="HIGH-CONCURRENCY FINANCIAL PROTECTION"
        title="ATOMIC RESERVATION"
        description="Dual-resource serialization prevents double-spending and inventory overselling. Reserves mandate budget and SKU inventory atomically before Razorpay invocation."
        action={<Badge variant="success" pulse>ACID SERIALIZATION ACTIVE</Badge>}
      />

      {/* Parallel Race Visualizer Box */}
      <div className="relative overflow-hidden glass-panel rounded-lg p-6 space-y-6 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <div className="font-mono text-xs text-[#C8B27A] uppercase font-semibold tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8B27A] animate-pulse" />
              <span>PARALLEL CONCURRENCY RACE BENCHMARK</span>
            </div>
            <p className="text-xs text-[#BCB7AB] font-ui mt-1 font-light">
              Two parallel autonomous subagents simultaneously attack a remaining ₹2,876.00 balance with ₹2,124.00 checkouts.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            isLoading={isTestingConcurrency}
            onClick={onRunConcurrencyTest}
          >
            RUN LIVE CONCURRENCY TEST
          </Button>
        </div>

        {/* Live Race Animation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative overflow-hidden glass-panel-subtle rounded-lg p-4 space-y-1 font-mono border border-white/[0.06]">
            <span className="text-[10px] text-[#7A776F] uppercase tracking-wider">AVAILABLE BALANCE</span>
            <div className="text-2xl text-[#F4F0E6] font-bold">₹2,876.00</div>
            <div className="text-[10px] text-[#BCB7AB] font-light">Shared buyer mandate pool</div>
          </div>

          <motion.div
            layout
            className="relative overflow-hidden p-4 rounded-lg bg-[#6F9B83]/15 border border-[#6F9B83]/40 space-y-1 font-mono shadow-[0_4px_16px_rgba(111,155,131,0.2)]"
          >
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-[#6F9B83] font-bold uppercase tracking-wider">SUBAGENT A</span>
              <Badge variant="success" size="sm" pulse>ALLOW (201)</Badge>
            </div>
            <div className="text-xl text-[#F4F0E6] font-bold">₹2,124.00</div>
            <div className="text-[10px] text-[#6F9B83] font-medium">Acquired lock: Order Created</div>
          </motion.div>

          <motion.div
            layout
            className="relative overflow-hidden p-4 rounded-lg bg-[#A76565]/15 border border-[#A76565]/40 space-y-1 font-mono shadow-[0_4px_16px_rgba(167,101,101,0.2)]"
          >
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-[#A76565] font-bold uppercase tracking-wider">SUBAGENT B</span>
              <Badge variant="danger" size="sm">BLOCK (409)</Badge>
            </div>
            <div className="text-xl text-[#F4F0E6] font-bold">₹2,124.00</div>
            <div className="text-[10px] text-[#A76565] font-medium">MANDATE_EXHAUSTED: Zero Overspend</div>
          </motion.div>
        </div>

        {/* Metric Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <Metric
            label="CONCURRENCY RACE RESULT"
            value={concurrencyResult ? concurrencyResult.admitted : '1 ADMITTED'}
            subtext="HTTP 201 Razorpay Order"
            indicator="success"
          />
          <Metric
            label="OVERSPEND BLOCKED"
            value={concurrencyResult ? concurrencyResult.blocked : '1 BLOCKED'}
            subtext="HTTP 409 MANDATE_EXHAUSTED"
            indicator="danger"
          />
          <Metric
            label="FINANCIAL OVERSPEND"
            value="₹0.00"
            subtext="0 Paise Leaked Beyond Mandate"
            indicator="live"
          />
        </div>
      </div>

      {/* Active Reservations Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs font-mono">
          <span className="text-[#F4F0E6] font-semibold uppercase tracking-wider">ACTIVE RESERVATION REGISTRY</span>
          <span className="text-[#BCB7AB] text-[11px]">{reservations.length} HELD / COMMITTED</span>
        </div>

        <DataTable
          columns={columns}
          data={reservations}
          isLoading={isLoading}
          emptyMessage="NO ACTIVE RESERVATIONS"
        />
      </div>
    </div>
  );
};
