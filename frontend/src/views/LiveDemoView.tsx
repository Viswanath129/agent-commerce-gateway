import React, { useState } from "react";
import { Button, SectionHeader, Badge } from "../components/ui/index.js";
import type { DemoScenarioType, DemoScenarioResult } from "../lib/api/types.js";

export interface LiveDemoViewProps {
  onRunScenario: (scenario: DemoScenarioType) => Promise<DemoScenarioResult>;
  isExecuting: boolean;
}

interface ScenarioOption {
  id: DemoScenarioType;
  label: string;
  desc: string;
}

const SCENARIOS: ScenarioOption[] = [
  { id: "happy-path", label: "[01] Nominal Flow", desc: "Valid Ed25519 mandate, true catalog price, reservation, order creation." },
  { id: "mandate-violation", label: "[02] Budget Overstep", desc: "Proposes ₹14,160.00 chair against ₹5,000.00 mandate cap. Intercepted." },
  { id: "concurrent", label: "[03] Double-Spend Race", desc: "Dual parallel checkouts vs remaining balance. Enforces 201 vs 409." },
  { id: "webhook-fail", label: "[04] Webhook Reconciliation", desc: "Forged HMAC signature delivery. Verifies rejection and deduplication." },
  { id: "refund", label: "[05] Safe Reversal Audit", desc: "Post-capture warehouse stockout triggers automatic policy-governed refund." },
];

export const LiveDemoView: React.FC<LiveDemoViewProps> = ({ onRunScenario, isExecuting }) => {
  const [selectedScenario, setSelectedScenario] = useState<DemoScenarioType>("happy-path");
  const [lastResult, setLastResult] = useState<DemoScenarioResult | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; msg: string; type: "info" | "success" | "error" | "highlight" }>>([
    { time: new Date().toLocaleTimeString(), msg: "AWAITING SEQUENCE INITIATION... (Click 'EXECUTE REAL BACKEND SCENARIO')", type: "info" },
  ]);

  const handleExecute = async () => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      { time: timeStr, msg: `DISPATCHING REAL BACKEND REQUEST [${selectedScenario.toUpperCase()}]`, type: "highlight" },
    ]);

    try {
      const result = await onRunScenario(selectedScenario);
      setLastResult(result);

      if (result.error) {
        setLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), msg: `GATEWAY ENFORCEMENT: ${result.error} — ${result.message || ""}`, type: "error" },
          { time: new Date().toLocaleTimeString(), msg: "EXECUTION HALTED. Razorpay rails were NOT invoked.", type: "error" },
        ]);
      } else if (result.scenario === "concurrent") {
        setLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), msg: `CONCURRENCY RACE: Subagent A -> HTTP ${result.subagentA?.status} (${(result.subagentA?.body as any)?.razorpay_order_id || "ORDER_CREATED"})`, type: "success" },
          { time: new Date().toLocaleTimeString(), msg: `CONCURRENCY RACE: Subagent B -> HTTP ${result.subagentB?.status} (${(result.subagentB?.body as any)?.error || "MANDATE_EXHAUSTED"})`, type: "error" },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), msg: `REAL BACKEND SUCCESS: Order ${result.razorpay_order_id || (result.orderCreated as any)?.razorpay_order_id || "CREATED"} committed to SHA-256 ledger.`, type: "success" },
        ]);
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), msg: `EXECUTION ERROR: ${err.message}`, type: "error" },
      ]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        eyebrow="REAL BACKEND INJECTION"
        title={
          <span>
            THE MODEL CAN PROPOSE ANYTHING.<br />IT CANNOT AUTHORIZE ANYTHING.
          </span>
        }
        description="Select an adversarial scenario below to observe real deterministic execution and state transitions."
      />

      {/* Scenario Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedScenario(s.id)}
              disabled={isExecuting}
              className={`px-3.5 py-2 font-mono-jb text-xs uppercase tracking-wider transition-all border ${
                selectedScenario === s.id
                  ? "bg-primary text-on-primary font-semibold border-primary"
                  : "bg-surface-container text-on-surface border-outline-variant/40 hover:border-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="md"
          isLoading={isExecuting}
          onClick={handleExecute}
          leftIcon={<span className="material-symbols-outlined text-[16px]">play_arrow</span>}
        >
          {isExecuting ? "EXECUTING REAL BACKEND SCENARIO..." : "EXECUTE REAL BACKEND SCENARIO"}
        </Button>
      </div>

      {/* Real Result Box */}
      {lastResult && (
        <div className="border border-outline-variant/40 bg-surface-container-low p-4 space-y-2 text-xs font-mono-jb animate-fadeIn">
          <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
            <span className="text-primary font-bold uppercase">
              {lastResult.error ? "ADVERSARIAL ATTEMPT INTERCEPTED" : "BACKEND EXECUTION COMMITTED"}
            </span>
            <Badge variant={lastResult.error ? "error" : "success"}>
              {lastResult.error ? lastResult.error : "HTTP 200/201 SUCCESS"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-on-surface-variant pt-1">
            {lastResult.intent_id && (
              <div>
                <span className="block uppercase text-[10px]">Intent ID:</span>
                <strong className="text-primary truncate block">{lastResult.intent_id}</strong>
              </div>
            )}
            {lastResult.razorpay_order_id && (
              <div>
                <span className="block uppercase text-[10px]">Razorpay Order:</span>
                <strong className="text-secondary">{lastResult.razorpay_order_id}</strong>
              </div>
            )}
            {lastResult.message && (
              <div className="md:col-span-2">
                <span className="block uppercase text-[10px]">Reason:</span>
                <strong className="text-on-surface">{lastResult.message}</strong>
              </div>
            )}
            {lastResult.scenario === "concurrent" && (
              <>
                <div>
                  <span className="block uppercase text-[10px]">Subagent A:</span>
                  <strong className="text-secondary">HTTP {lastResult.subagentA?.status} (Admitted)</strong>
                </div>
                <div>
                  <span className="block uppercase text-[10px]">Subagent B:</span>
                  <strong className="text-error">HTTP {lastResult.subagentB?.status} ({(lastResult.subagentB?.body as any)?.error})</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Visual Pipeline Box */}
      <div className="border border-outline-variant/40 bg-surface-container-lowest p-8 flex flex-col justify-between min-h-[380px]">
        {/* Nodes Display */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 my-auto">
          {[
            { id: "agent", icon: "smart_toy", num: "1", title: "Intent", desc: "Propose" },
            { id: "mandate", icon: "verified_user", num: "2", title: "Mandate", desc: "Ed25519" },
            { id: "truth", icon: "database", num: "3", title: "Truth", desc: "DB Catalog" },
            { id: "policy", icon: "gavel", num: "4", title: "Policy", desc: "DSL Engine" },
            { id: "reserve", icon: "lock", num: "5", title: "Reserve", desc: "ACID Lock" },
            { id: "razorpay", icon: "payments", num: "6", title: "Razorpay", desc: "Rail Order" },
            { id: "audit", icon: "receipt_long", num: "7", title: "Audit", desc: "SHA-256" },
          ].map((n) => (
            <div key={n.id} className="flex flex-col items-center text-center p-3 border border-outline-variant/30 bg-surface-container-low">
              <div className="w-12 h-12 bg-surface-container border border-outline-variant flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-primary text-[20px]">{n.icon}</span>
              </div>
              <span className="font-mono-jb text-[11px] text-on-surface uppercase font-bold">
                {n.num}. {n.title}
              </span>
              <span className="text-[10px] font-mono-jb text-on-surface-variant/70">{n.desc}</span>
            </div>
          ))}
        </div>

        {/* Live Trace Log */}
        <div className="mt-8 pt-4 border-t border-outline-variant/30 flex flex-col h-32 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono-jb text-on-surface-variant pb-1 border-b border-outline-variant/20 mb-1">
            <span>LIVE EXECUTION TRACE LOG</span>
            <span className="text-primary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> DETERMINISTIC ENGINE ACTIVE
            </span>
          </div>
          <div className="overflow-y-auto flex-1 font-mono-jb text-xs space-y-1">
            {logs.map((log, idx) => {
              const colorMap = {
                info: "text-on-surface-variant",
                success: "text-secondary font-semibold",
                error: "text-error font-semibold",
                highlight: "text-primary font-bold",
              }[log.type];
              return (
                <div key={idx} className={`${colorMap} uppercase tracking-wide`}>
                  <span className="text-outline-variant">{log.time}</span> &mdash; {log.msg}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
