import React from 'react';

export interface ErrorStateProps {
  title?: string;
  statusCode?: number;
  errorCode?: string;
  message?: string;
  razorpayStatus?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'FORENSIC ENFORCEMENT INTERCEPTION',
  statusCode,
  errorCode,
  message,
  razorpayStatus = 'NOT CALLED (INTERCEPTED AT GATE)',
  onRetry,
}) => {
  return (
    <div className="p-5 border border-[#A76565]/40 bg-[#A76565]/10 space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-[#A76565]/30 pb-2">
        <span className="text-[#A76565] font-bold uppercase tracking-wider">
          {title} {statusCode ? `[HTTP ${statusCode}]` : ''}
        </span>
        {errorCode && (
          <span className="px-2 py-0.5 border border-[#A76565] text-[#A76565] bg-[#A76565]/20 font-bold text-[10px]">
            {errorCode}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] pt-1">
        <div>
          <span className="text-[#77746C] block uppercase text-[10px]">Enforcement Rationale:</span>
          <span className="text-[#F2EEE4] font-medium">{message || 'Gateway constraint violated.'}</span>
        </div>
        <div>
          <span className="text-[#77746C] block uppercase text-[10px]">Downstream Payment Rail:</span>
          <span className="text-[#A76565] font-bold">{razorpayStatus}</span>
        </div>
      </div>

      {onRetry && (
        <div className="pt-2 border-t border-[#A76565]/20">
          <button
            onClick={onRetry}
            className="text-[10px] uppercase text-[#C8B27A] hover:underline"
          >
            REFETCH REPOSITORIES
          </button>
        </div>
      )}
    </div>
  );
};
