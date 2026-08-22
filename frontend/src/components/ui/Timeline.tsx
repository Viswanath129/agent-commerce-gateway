import React from "react";
import type { AuditTrajectoryStep } from "../../lib/api/types.js";

export interface TimelineProps {
  steps: AuditTrajectoryStep[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, className = "" }) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="p-4 bg-surface-container-low border border-outline-variant/20 text-xs font-mono-jb text-on-surface-variant">
        No execution trajectory recorded.
      </div>
    );
  }

  return (
    <div className={`space-y-4 font-mono-jb text-xs ${className}`}>
      {steps.map((step, idx) => (
        <div key={step.audit_id || idx} className="narrative-step relative flex items-start gap-4 pb-4">
          <div className="narrative-line" />
          <div className="w-8 h-8 bg-surface-container border border-primary/40 flex items-center justify-center text-primary font-bold z-10 text-[11px] flex-shrink-0">
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2">
              <h4 className="font-bodoni text-base text-on-surface truncate">{step.event_type}</h4>
              <span className="text-[10px] text-secondary flex-shrink-0">
                {new Date(step.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-on-surface-variant text-[11px] mt-0.5">
              {step.previous_state || "INIT"} &rarr; <span className="text-primary font-semibold">{step.new_state}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
