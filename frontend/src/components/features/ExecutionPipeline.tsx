import React from "react";

export type StageState = "idle" | "processing" | "success" | "blocked" | "failed";

export interface PipelineStage {
  id: string;
  num: string;
  name: string;
  description: string;
  state: StageState;
}

export interface ExecutionPipelineProps {
  stages?: PipelineStage[];
  activeStageIndex?: number;
  className?: string;
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: "intent", num: "1", name: "INTENT", description: "Zod Schema & Nonce Validation", state: "success" },
  { id: "mandate", num: "2", name: "MANDATE", description: "Noble Ed25519 Cryptographic Verification", state: "success" },
  { id: "truth", num: "3", name: "TRUTH", description: "SQLite Catalog Price Grounding", state: "success" },
  { id: "policy", num: "4", name: "POLICY", description: "Merchant Policy DSL Enforcement", state: "success" },
  { id: "reserve", num: "5", name: "RESERVE", description: "Dual-Resource ACID Serialization", state: "success" },
  { id: "razorpay", num: "6", name: "RAZORPAY", description: "Idempotent Rail Execution", state: "success" },
  { id: "audit", num: "7", name: "AUDIT", description: "SHA-256 Backwards Hash Chaining", state: "success" },
];

export const ExecutionPipeline: React.FC<ExecutionPipelineProps> = ({
  stages = DEFAULT_STAGES,
  className = "",
}) => {
  const getStateBadge = (state: StageState) => {
    switch (state) {
      case "processing":
        return <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />;
      case "success":
        return <span className="w-2.5 h-2.5 rounded-full bg-secondary" />;
      case "blocked":
        return <span className="w-2.5 h-2.5 rounded-full bg-error" />;
      case "failed":
        return <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />;
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-outline-variant" />;
    }
  };

  return (
    <div className={`border border-outline-variant/30 bg-surface-container-lowest p-6 ${className}`}>
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">security</span>
          <h3 className="font-bodoni text-xl text-primary uppercase">Deterministic 7-Phase Execution Pipeline</h3>
        </div>
        <span className="text-xs font-mono-jb text-secondary flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" /> 0 PROBABILISTIC LEAKS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {stages.map((stage) => {
          const isSuccess = stage.state === "success";
          const isBlocked = stage.state === "blocked";
          const isProcessing = stage.state === "processing";

          return (
            <div
              key={stage.id}
              className={`p-3 border flex flex-col justify-between transition-all ${
                isBlocked
                  ? "bg-error/10 border-error/40 text-error"
                  : isProcessing
                  ? "bg-primary/10 border-primary/60 text-primary"
                  : isSuccess
                  ? "bg-surface-container-low border-outline-variant/30 text-on-surface"
                  : "bg-surface-container-lowest border-outline-variant/10 text-on-surface-variant opacity-60"
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono-jb text-[10px] text-primary/80 uppercase font-bold">
                  PHASE {stage.num}
                </span>
                {getStateBadge(stage.state)}
              </div>

              <div className="my-1">
                <div className="font-mono-jb text-xs font-bold uppercase">{stage.name}</div>
                <div className="text-[10px] font-mono-jb text-on-surface-variant/80 mt-1 leading-snug">
                  {stage.description}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-outline-variant/10 text-[9px] font-mono-jb uppercase tracking-wider font-semibold">
                {stage.state}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
