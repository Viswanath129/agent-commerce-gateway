import React from 'react';
import { formatTimestamp } from '../../lib/formatters/index.js';

export interface TimelineStepItem {
  id: string | number;
  timestamp?: number | string;
  eventType: string;
  title: string;
  description?: string;
  status?: 'SUCCESS' | 'BLOCKED' | 'FAILED' | 'PENDING' | 'RECONCILED' | string;
  hash?: string;
  payload?: Record<string, unknown> | null;
}

export interface TimelineProps {
  steps: TimelineStepItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, className = '' }) => {
  if (steps.length === 0) {
    return (
      <div className="p-8 text-center border border-[#302F2B] bg-[#181816] text-xs font-mono text-[#77746C]">
        NO TRAJECTORY STEPS RECORDED
      </div>
    );
  }

  return (
    <div className={`relative pl-6 space-y-6 ${className}`}>
      {/* Continuous thin vertical rule */}
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-[#302F2B]" />

      {steps.map((step, idx) => {
        const isError =
          step.status === 'BLOCKED' ||
          step.status === 'FAILED' ||
          step.eventType.includes('FAILED') ||
          step.eventType.includes('VIOLATION') ||
          step.eventType.includes('REJECTED');

        const isReconciliation =
          step.status === 'RECONCILED' ||
          step.eventType.includes('REFUND') ||
          step.eventType.includes('WEBHOOK');

        const markerColor = isError
          ? 'bg-[#A76565] border-[#A76565]'
          : isReconciliation
          ? 'bg-[#827995] border-[#827995]'
          : 'bg-[#6F9B83] border-[#6F9B83]';

        return (
          <div key={step.id || idx} className="relative group">
            {/* Dot marker */}
            <span
              className={`absolute -left-[19px] top-1.5 w-2 h-2 rounded-full border ${markerColor}`}
            />

            <div className="p-4 bg-[#181816] border border-[#302F2B] space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-[#302F2B]/40 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#C8B27A] font-semibold uppercase">
                    PHASE {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-xs text-[#F2EEE4] font-medium">
                    {step.title || step.eventType}
                  </span>
                </div>
                {step.timestamp && (
                  <span className="font-mono text-[10px] text-[#77746C]">
                    {formatTimestamp(step.timestamp)}
                  </span>
                )}
              </div>

              {step.description && (
                <p className="font-mono text-xs text-[#B8B3A7] leading-relaxed">
                  {step.description}
                </p>
              )}

              {step.hash && (
                <div className="font-mono text-[10px] text-[#77746C] truncate">
                  <span className="text-[#B8B3A7]">SHA-256:</span> {step.hash}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
