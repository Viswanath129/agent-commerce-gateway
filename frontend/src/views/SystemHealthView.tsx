import React from "react";
import { SectionHeader, Badge, Panel, StatusIndicator, CodeBlock } from "../components/ui/index.js";
import type { SystemHealthResponse } from "../lib/api/types.js";

export interface SystemHealthViewProps {
  health: SystemHealthResponse | null;
  isLoading: boolean;
}

export const SystemHealthView: React.FC<SystemHealthViewProps> = ({ health, isLoading }) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        eyebrow="INFRASTRUCTURE & PROTOCOL ADAPTERS"
        title="SYSTEM HEALTH & PROTOCOL ADAPTERS"
        description="Real-time operational health checks and standard agent ingress integration examples."
        action={
          <div className="flex items-center gap-2">
            <StatusIndicator status={health?.status || "HEALTHY"} label="HEALTHY // LIVE" />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Node Probes */}
        <div className="lg:col-span-6">
          <Panel title="Operational Node Health">
            <div className="space-y-3 text-xs font-mono-jb">
              {isLoading || !health ? (
                <div className="text-on-surface-variant">Probing component status...</div>
              ) : (
                Object.entries(health.components).map(([name, comp]) => (
                  <div
                    key={name}
                    className="flex justify-between items-center p-3 bg-surface-container-low border border-outline-variant/20"
                  >
                    <div>
                      <div className="text-on-surface font-bold uppercase">{name.replace(/_/g, " ")}</div>
                      <div className="text-[10px] text-on-surface-variant">
                        {comp.engine ||
                          comp.mode ||
                          comp.active_version ||
                          (comp.blocks !== undefined ? `${comp.blocks} blocks checked` : "Operational")}
                      </div>
                    </div>
                    <Badge variant={comp.status === "LIVE" || comp.status === "READY" || comp.status === "CONNECTED" || comp.status === "INTEGRITY_VERIFIED" ? "success" : "error"}>
                      {comp.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* Right Column: Protocols & cURL */}
        <div className="lg:col-span-6 space-y-4">
          <Panel title="Supported Agent Ingress Protocols">
            <div className="space-y-4 text-xs font-mono-jb">
              <div className="p-3 bg-surface-container-low border border-outline-variant/20">
                <span className="text-primary font-bold block mb-1">MCP (Model Context Protocol)</span>
                <p className="text-on-surface-variant text-[11px]">
                  Exposes tools: <code className="text-on-surface">propose_checkout(intent_payload)</code> and{" "}
                  <code className="text-on-surface">query_catalog()</code>.
                </p>
              </div>

              <div className="p-3 bg-surface-container-low border border-outline-variant/20">
                <span className="text-primary font-bold block mb-1">ACP / AP2 Standard REST Ingress</span>
                <p className="text-on-surface-variant text-[11px] mb-2">
                  Standard JSON REST endpoint for autonomous checkout sessions:
                </p>
                <CodeBlock
                  title="REST cURL Ingress"
                  language="bash"
                  code={`curl -X POST http://localhost:3000/v1/agent/checkout \\
  -H "Content-Type: application/json" \\
  -d '{
    "intent_id": "416ee454-e69c-48c9-bbef-88ebc22d71ee",
    "client_nonce": "9e2a8747f4...",
    "timestamp": 1771737600,
    "mandate": { ... },
    "proposed_items": [{ "sku": "SKU-MOUSE-PRO", "quantity": 1 }]
  }'`}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
