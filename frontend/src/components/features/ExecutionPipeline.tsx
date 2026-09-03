import React from 'react';
import { motion } from 'framer-motion';

export type StageStatus = 'idle' | 'processing' | 'success' | 'blocked' | 'failed';

export interface PipelineStageDef {
  id: string;
  num: string;
  name: string;
  description: string;
  status: StageStatus;
  detail?: string;
}

export interface ExecutionPipelineProps {
  stages: PipelineStageDef[];
  activeStageIndex?: number;
  className?: string;
}

export const ExecutionPipeline: React.FC<ExecutionPipelineProps> = ({
  stages,
  className = '',
}) => {
  return (
    <div className={`relative overflow-hidden glass-panel rounded-lg p-5 md:p-6 space-y-4 border border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.6)] ${className}`}>
      {/* Specular top rim shine */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-[#C8B27A] font-semibold uppercase tracking-wider">
            LIVE SYSTEM PIPELINE
          </span>
          <span className="text-xs font-mono text-white/20">//</span>
          <span className="font-display text-sm text-[#F4F0E6] italic font-normal">
            Deterministic Decision Trajectory
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#6F9B83] bg-[#6F9B83]/10 px-2.5 py-1 rounded-full border border-[#6F9B83]/30 shadow-[0_0_12px_rgba(111,155,131,0.15)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6F9B83] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#6F9B83]" />
          </span>
          <span className="font-semibold tracking-wider">ZERO PROBABILISTIC LEAKS</span>
        </div>
      </div>

      {/* Linework Pipeline Display */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stages.map((stage) => {
          const isSuccess = stage.status === 'success';
          const isBlocked = stage.status === 'blocked' || stage.status === 'failed';
          const isProcessing = stage.status === 'processing';
          const isIdle = stage.status === 'idle';

          const cardStyles = isBlocked
            ? 'border-[#A76565]/60 bg-[#A76565]/15 shadow-[0_0_16px_rgba(167,101,101,0.25)]'
            : isProcessing
            ? 'border-[#C8B27A] bg-[#C8B27A]/20 shadow-[0_0_20px_rgba(200,178,122,0.35)]'
            : isSuccess
            ? 'border-[#6F9B83]/40 bg-[#6F9B83]/10 shadow-[0_0_12px_rgba(111,155,131,0.15)]'
            : 'border-white/[0.06] bg-white/[0.02] opacity-50';

          const statusColor = isBlocked
            ? 'text-[#A76565]'
            : isProcessing
            ? 'text-[#C8B27A]'
            : isSuccess
            ? 'text-[#6F9B83]'
            : 'text-[#7A776F]';

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0.8, y: 0 }}
              animate={{
                opacity: isIdle ? 0.5 : 1,
                scale: isProcessing ? 1.03 : 1,
              }}
              transition={{ duration: 0.2 }}
              className={`p-3.5 rounded-lg border flex flex-col justify-between relative backdrop-blur-md overflow-hidden transition-all duration-200 ${cardStyles}`}
            >
              {/* Specular highlight */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

              <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                <span className="text-[#7A776F] font-semibold">{stage.num}</span>
                <span className={`uppercase font-bold text-[9px] tracking-wider ${statusColor}`}>
                  {stage.status}
                </span>
              </div>

              <div className="my-1.5 space-y-1">
                <div className="font-mono text-xs font-semibold text-[#F4F0E6] tracking-wide">
                  {stage.name}
                </div>
                <div className="font-mono text-[10px] text-[#BCB7AB] leading-snug">
                  {stage.description}
                </div>
              </div>

              {stage.detail && (
                <div className="mt-2 pt-1.5 border-t border-white/[0.06] text-[9px] font-mono text-[#C8B27A] truncate font-medium">
                  {stage.detail}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
