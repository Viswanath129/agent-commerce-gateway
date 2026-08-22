import React from "react";
import { Button, SectionHeader, Badge, Metric, DataTable, type ColumnDef } from "../components/ui/index.js";
import type { Reservation } from "../lib/api/types.js";

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
      key: "reservation_id",
      header: "Reservation ID",
      render: (r) => <span className="text-primary">{r.reservation_id}</span>,
    },
    {
      key: "intent_id",
      header: "Intent ID",
      render: (r) => <span className="truncate block max-w-[120px]">{r.intent_id}</span>,
    },
    {
      key: "mandate_id",
      header: "Mandate ID",
      render: (r) => <span className="truncate block max-w-[120px]">{r.mandate_id}</span>,
    },
    {
      key: "reserved_budget",
      header: "Reserved Amount",
      render: (r) => <span className="font-bold">₹{(r.reserved_budget / 100).toFixed(2)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={r.status === "HELD" ? "text-secondary font-bold" : "text-on-surface-variant"}>
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        eyebrow="HIGH-CONCURRENCY PROTECTION"
        title="DUAL-RESOURCE ACID LOCK"
        description="Atomic budget decrement and inventory stock lock via SQLite BEGIN IMMEDIATE serialization."
        action={<Badge variant="success">BEGIN IMMEDIATE TRANSACTION</Badge>}
      />

      <div className="border border-outline-variant/30 bg-surface-container-lowest p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bodoni text-2xl text-primary">Parallel Concurrency Attack Test</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Fires 2 simultaneous parallel checkouts against remaining mandate balance.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            isLoading={isTestingConcurrency}
            onClick={onRunConcurrencyTest}
          >
            Run Live Concurrency Test
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Metric
            label="Parallel Subagents"
            value="2 Subagents"
            subtext="Simultaneous Ingress"
            variant="primary"
          />
          <Metric
            label="Admitted by ACID Lock"
            value={concurrencyResult ? concurrencyResult.admitted : "-"}
            subtext="HTTP 201 Created"
            variant="secondary"
          />
          <Metric
            label="Overspend Blocked"
            value={concurrencyResult ? concurrencyResult.blocked : "-"}
            subtext="HTTP 409 MANDATE_EXHAUSTED"
            variant="error"
          />
        </div>

        {/* Reservations Table */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-mono-jb text-on-surface uppercase font-bold">
            Active Persisted Reservations:
          </h4>
          <DataTable
            columns={columns}
            data={reservations}
            keyExtractor={(r) => r.reservation_id}
            isLoading={isLoading}
            emptyMessage="No active held reservations."
          />
        </div>
      </div>
    </div>
  );
};
