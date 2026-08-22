import React from "react";
import { Timeline, CodeBlock, SectionHeader, Badge } from "../components/ui/index.js";
import type { TransactionDetailResponse } from "../lib/api/types.js";

export interface TransactionsViewProps {
  detail: TransactionDetailResponse | null;
  isLoading: boolean;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ detail, isLoading }) => {
  const session = detail?.session;
  const trajectory = detail?.trajectory || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        eyebrow="TRANSACTION INSPECTOR"
        title={session ? session.razorpay_order_id || session.intent_id : "TRANSACTION DETAIL"}
        description="Persisted State & Cryptographic Audit Trajectory"
        action={
          session ? (
            <div className="flex flex-col items-end gap-1">
              <div className="text-right">
                <span className="text-[11px] font-mono-jb text-on-surface-variant uppercase block">
                  Settled Total (INR)
                </span>
                <span className="font-bodoni text-4xl text-primary">₹{(session.amount / 100).toFixed(2)}</span>
              </div>
              <Badge variant={session.status === "ORDER_CREATED" || session.status === "PAYMENT_CAPTURED" ? "success" : "neutral"}>
                {session.status}
              </Badge>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Timeline */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="font-bodoni text-2xl text-on-surface italic border-b border-outline-variant/30 pb-2">
            Persisted Audit Trajectory
          </h2>
          {isLoading ? (
            <div className="p-8 text-center text-xs font-mono-jb text-on-surface-variant">Loading trajectory...</div>
          ) : (
            <Timeline steps={trajectory} />
          )}
        </div>

        {/* Right Column: Metadata & Raw JSON */}
        <div className="lg:col-span-5 space-y-6">
          {/* Metadata */}
          <div className="border border-outline-variant/30 p-4 bg-surface-container-lowest">
            <h3 className="text-xs font-mono-jb text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/20 pb-2 mb-3">
              Persisted Session Metadata
            </h3>
            {session ? (
              <div className="space-y-2 text-xs font-mono-jb">
                <div className="flex justify-between gap-2">
                  <span className="text-on-surface-variant">Intent ID:</span>
                  <span className="text-on-surface truncate max-w-[200px]">{session.intent_id}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-on-surface-variant">Receipt:</span>
                  <span className="text-on-surface truncate max-w-[200px]">{session.receipt}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-on-surface-variant">Reservation ID:</span>
                  <span className="text-on-surface">{session.reservation_id}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-on-surface-variant">Razorpay Order:</span>
                  <span className="text-primary font-bold">{session.razorpay_order_id || "-"}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono-jb text-on-surface-variant">No transaction loaded.</div>
            )}
          </div>

          {/* Raw JSON */}
          <CodeBlock
            title="Database Record JSON (Authoritative)"
            code={detail ? JSON.stringify(detail, null, 2) : "{}"}
            language="json"
          />
        </div>
      </div>
    </div>
  );
};
