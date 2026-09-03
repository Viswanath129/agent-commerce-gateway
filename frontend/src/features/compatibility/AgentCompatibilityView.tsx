import React, { useState } from 'react';
import { SectionHeader } from '../../components/ui/SectionHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { CodeBlock } from '../../components/ui/CodeBlock.js';
import { compatibilityApi } from '../../lib/api/compatibilityApi.js';
import type { CompatibilityMatrixResponse } from '../../types/index.js';

export interface AgentCompatibilityViewProps {
  matrix: CompatibilityMatrixResponse | null;
  onRefresh: () => void;
}

export const AgentCompatibilityView: React.FC<AgentCompatibilityViewProps> = ({
  matrix,
  onRefresh,
}) => {
  const [selectedProto, setSelectedProto] = useState('mcp');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const runAdapterTest = async (proto: string) => {
    try {
      setIsTesting(true);
      setSelectedProto(proto);
      setTestError(null);
      setTestResult(null);
      const res = await compatibilityApi.testAdapter(proto);
      setTestResult(res);
      onRefresh();
    } catch (err: any) {
      setTestError(err.message || 'Adapter simulation failed');
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'LIVE' || status === 'IMPLEMENTED + TESTED') {
      return <Badge variant="live" size="sm" pulse>{status}</Badge>;
    }
    if (status === 'ARCHITECTURE READY' || status === 'ARCHITECTURE-READY') {
      return <Badge variant="warning" size="sm">{status}</Badge>;
    }
    if (status === 'DESIGN' || status === 'TRUST ADAPTER DESIGN') {
      return <Badge variant="reconciliation" size="sm">{status}</Badge>;
    }
    return <Badge variant="neutral" size="sm">{status}</Badge>;
  };

  return (
    <div className="space-y-10">
      {/* Strategic Header */}
      <SectionHeader
        eyebrow="UNIVERSAL AGENT INGRESS ARCHITECTURE"
        title="AGENT COMPATIBILITY"
        description="One deterministic control plane. Many agent ecosystems. We don't replace the agent, the protocol, the payment intelligence, or Razorpay. We provide the merchant-side control boundary."
        action={
          <Button variant="glass" size="sm" onClick={onRefresh}>
            REFRESH MATRIX
          </Button>
        }
      />

      {/* Strategic Architectural Diagram (Liquid Glass Linework) */}
      <div className="relative overflow-hidden glass-panel rounded-lg p-6 space-y-4 font-mono shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="text-xs text-[#C8B27A] uppercase tracking-wider font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C8B27A] shadow-[0_0_8px_rgba(200,178,122,0.6)]" />
          <span>SYSTEM ARCHITECTURE & AUTHORITY BOUNDARIES</span>
        </div>

        <div className="p-6 rounded-lg bg-[#10100F]/80 border border-white/[0.06] text-center space-y-2.5 text-xs backdrop-blur-md">
          <div className="inline-block px-5 py-2.5 rounded-lg border border-white/10 bg-[#161614] text-[#F4F0E6] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            ANY AI MODEL (ChatGPT / Claude / Gemini / Open Models)
            <div className="text-[10px] text-[#7A776F] mt-0.5">ROLE: INTELLIGENCE & PROPOSAL (ZERO AUTHORITY)</div>
          </div>
          <div className="text-[#C8B27A] text-sm font-bold">↓</div>
          <div className="inline-block px-5 py-2.5 rounded-lg border border-white/10 bg-[#161614] text-[#F4F0E6] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            AGENT / PROTOCOL INGRESS (MCP / A2A / ACP / AP2 / UCP / REST)
            <div className="text-[10px] text-[#7A776F] mt-0.5">ROLE: PROTOCOL ADAPTER NORMALIZATION</div>
          </div>
          <div className="text-[#C8B27A] text-sm font-bold">↓</div>
          <div className="inline-block px-6 py-3.5 rounded-lg border border-[#C8B27A] bg-gradient-to-b from-[#C8B27A]/20 to-[#C8B27A]/5 text-[#C8B27A] font-bold shadow-[0_0_24px_rgba(200,178,122,0.25)]">
            AGENT COMMERCE GATEWAY (ACG CONTROL PLANE)
            <div className="text-[10px] text-[#F4F0E6] mt-0.5 font-normal">ROLE: DETERMINISTIC MERCHANT AUTHORIZATION (AUTHORITATIVE)</div>
          </div>
          <div className="text-[#C8B27A] text-sm font-bold">↓</div>
          <div className="inline-block px-5 py-2.5 rounded-lg border border-[#B28A52]/40 bg-[#B28A52]/10 text-[#B28A52] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            PAYMENT INTELLIGENCE (Razorpay Vulcan Advisory)
            <div className="text-[10px] text-[#7A776F] mt-0.5">ROLE: DOWNSTREAM ROUTING & RISK TELEMETRY (ADVISORY ONLY)</div>
          </div>
          <div className="text-[#C8B27A] text-sm font-bold">↓</div>
          <div className="inline-block px-5 py-2.5 rounded-lg border border-[#6F9B83]/40 bg-[#6F9B83]/10 text-[#6F9B83] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            RAZORPAY PAYMENT RAILS
            <div className="text-[10px] text-[#7A776F] mt-0.5">ROLE: FINANCIAL SETTLEMENT & EXECUTION</div>
          </div>
        </div>
      </div>

      {/* 4 Architectural Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Model Surfaces */}
        <div className="relative overflow-hidden glass-panel rounded-lg p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
          <div className="border-b border-white/[0.06] pb-3">
            <h3 className="font-display text-lg text-[#F4F0E6] font-normal tracking-wide">1. Model Surfaces</h3>
            <p className="text-xs font-mono text-[#BCB7AB] font-light">Independent of AI model vendor or runtime</p>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {(matrix?.models || [
              { name: 'OpenAI (ChatGPT Apps / GPT-4o)', status: 'READY', role: 'Proposer', authority: 'NONE' },
              { name: 'Anthropic (Claude 3.5 / 3.7 Sonnet)', status: 'READY', role: 'Proposer', authority: 'NONE' },
              { name: 'Google (Gemini 2.0 / 3.7)', status: 'READY', role: 'Proposer', authority: 'NONE' },
              { name: 'Open Models & IDEs (Cursor / Windsurf)', status: 'READY', role: 'Proposer', authority: 'NONE' },
              { name: 'Custom Enterprise Agents', status: 'READY', role: 'Proposer', authority: 'NONE' },
            ]).map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                <div>
                  <span className="text-[#F4F0E6] font-medium block">{m.name}</span>
                  <span className="text-[10px] text-[#7A776F]">Authority: {m.authority}</span>
                </div>
                {getStatusBadge(m.status)}
              </div>
            ))}
          </div>
        </div>

        {/* 2. Protocol Ingress */}
        <div className="relative overflow-hidden glass-panel rounded-lg p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
          <div className="border-b border-white/[0.06] pb-3">
            <h3 className="font-display text-lg text-[#F4F0E6] font-normal tracking-wide">2. Protocol Ingress Adapters</h3>
            <p className="text-xs font-mono text-[#BCB7AB] font-light">Canonical IR normalization into ACG format</p>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {(matrix?.protocols || [
              { name: 'Native ACG Protocol', code: 'ACG', status: 'LIVE', version: 'v1.0.0' },
              { name: 'REST Financial Action Ingress', code: 'REST', status: 'LIVE', version: 'v1.0.0' },
              { name: 'Model Context Protocol (MCP)', code: 'MCP', status: 'ADAPTER READY', version: '2024-11-05' },
              { name: 'Agent2Agent Protocol (A2A)', code: 'A2A', status: 'ADAPTER READY', version: '2026.1-LF' },
              { name: 'Agentic Commerce Protocol (ACP)', code: 'ACP', status: 'ADAPTER READY', version: 'acp/1.0' },
              { name: 'Agent Payments Protocol (AP2)', code: 'AP2', status: 'ADAPTER READY', version: 'v0.2.0' },
              { name: 'Universal Commerce Protocol (UCP)', code: 'UCP', status: 'ADAPTER READY', version: 'ucp-v1.2' },
              { name: 'Visa Trusted Agent Protocol (TAP)', code: 'TAP', status: 'DESIGN', version: 'tap/1.0-draft' },
            ]).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                <div>
                  <span className="text-[#F4F0E6] font-medium block">{p.name}</span>
                  <span className="text-[10px] text-[#7A776F]">Version: {p.version}</span>
                </div>
                {getStatusBadge(p.status)}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Payment Intelligence */}
        <div className="relative overflow-hidden glass-panel rounded-lg p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
          <div className="border-b border-white/[0.06] pb-3">
            <h3 className="font-display text-lg text-[#F4F0E6] font-normal tracking-wide">3. Payment Intelligence Layer</h3>
            <p className="text-xs font-mono text-[#BCB7AB] font-light">Advisory fraud & routing signals (strictly non-authoritative)</p>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {(matrix?.payment_intelligence || [
              {
                name: 'Heuristic Risk Evaluator',
                status: 'LIVE',
                role: 'Deterministic policy velocity checks',
                authority: 'ADVISORY_ONLY',
              },
              {
                name: 'Razorpay Vulcan Foundation Model',
                status: 'ARCHITECTURE READY',
                role: 'Downstream payment routing & fraud signals',
                authority: 'ADVISORY_ONLY',
              },
              {
                name: 'Pluggable Enterprise Risk Feed',
                status: 'PLUGGABLE',
                role: 'External risk provider adapter interface',
                authority: 'ADVISORY_ONLY',
              },
            ]).map((pi, i) => (
              <div key={i} className="p-3 rounded-md bg-white/[0.02] border border-white/[0.04] space-y-1 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[#F4F0E6] font-medium">{pi.name}</span>
                  {getStatusBadge(pi.status)}
                </div>
                <div className="text-[10px] text-[#7A776F]">
                  Role: {pi.role} | Authority: {pi.authority}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Payment Settlement Rails */}
        <div className="relative overflow-hidden glass-panel rounded-lg p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
          <div className="border-b border-white/[0.06] pb-3">
            <h3 className="font-display text-lg text-[#F4F0E6] font-normal tracking-wide">4. Payment Rails</h3>
            <p className="text-xs font-mono text-[#BCB7AB] font-light">Execution rails governed by ACG authorization</p>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {(matrix?.payment_rails || [
              { name: 'Razorpay Sandbox / Standard', status: 'LIVE', type: 'Core Settlement Rail' },
              { name: 'UPI Reserve Pay', status: 'RAIL', type: 'Pre-authorized delegated rail' },
              { name: 'Cards & Netbanking', status: 'RAIL', type: 'Card network tokenization' },
              { name: 'Machine Payments (x402 / MPP)', status: 'PLUGGABLE', type: 'HTTP-native machine rail' },
            ]).map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                <div>
                  <span className="text-[#F4F0E6] font-medium block">{r.name}</span>
                  <span className="text-[10px] text-[#7A776F]">Type: {r.type}</span>
                </div>
                {getStatusBadge(r.status)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Adapter Testbench */}
      <div className="relative overflow-hidden glass-panel rounded-lg p-6 space-y-4 font-mono text-xs shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-xl text-[#F4F0E6] font-normal tracking-wide">Live Protocol Adapter Ingress Testbench</h3>
          <p className="text-xs text-[#BCB7AB] mt-0.5 font-light">Simulate real ingress payload normalization through verified protocol adapters</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'acg', label: 'ACG NATIVE (LIVE)' },
              { id: 'mcp', label: 'MCP (MODEL CONTEXT)' },
              { id: 'a2a', label: 'A2A (AGENT2AGENT)' },
              { id: 'acp', label: 'ACP (AGENTIC COMMERCE)' },
              { id: 'ap2', label: 'AP2 (AGENT PAYMENTS)' },
              { id: 'ucp', label: 'UCP (UNIVERSAL COMMERCE)' },
              { id: 'tap', label: 'TAP (VISA TRUSTED)' },
            ].map((proto) => (
              <Button
                key={proto.id}
                variant={selectedProto === proto.id ? 'primary' : 'glass'}
                size="xs"
                disabled={isTesting}
                onClick={() => runAdapterTest(proto.id)}
              >
                {proto.label}
              </Button>
            ))}
          </div>

          {isTesting && (
            <div className="p-6 text-center rounded-lg border border-[#C8B27A]/50 bg-[rgba(200,178,122,0.1)] text-[#C8B27A] backdrop-blur-md animate-pulse">
              Normalizing {selectedProto.toUpperCase()} payload into Canonical Intent & executing ACG verification...
            </div>
          )}

          {testError && (
            <div className="p-3 rounded-lg border border-[#A76565]/50 bg-[#A76565]/10 text-[#A76565]">
              Simulation Error: {testError}
            </div>
          )}

          {testResult && !isTesting && (
            <div className="relative overflow-hidden p-4 rounded-lg bg-[#10100F]/90 border border-white/10 space-y-3 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-[#6F9B83] font-bold uppercase tracking-wider">
                  ✓ {selectedProto.toUpperCase()} INGRESS ADAPTER VERIFIED
                </span>
                <Badge variant="success" pulse>ORDER CREATED (201)</Badge>
              </div>

              <CodeBlock
                title="Normalized Ingress Response"
                language="json"
                code={JSON.stringify(testResult, null, 2)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
