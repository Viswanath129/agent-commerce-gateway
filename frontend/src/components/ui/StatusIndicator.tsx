import React from 'react';

export interface StatusIndicatorProps {
  status: 'LIVE' | 'READY' | 'CONNECTED' | 'INTEGRITY_VERIFIED' | 'TAMPER_DETECTED' | 'WARNING' | 'ERROR' | string;
  label?: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
  pulse = true,
}) => {
  const isHealthy =
    status === 'LIVE' ||
    status === 'READY' ||
    status === 'CONNECTED' ||
    status === 'HEALTHY' ||
    status === 'INTEGRITY_VERIFIED';

  const isWarning = status === 'ADVISORY_ACTIVE' || status === 'WARNING' || status === 'ARCHITECTURE READY';

  const dotColor = isHealthy ? 'bg-[#6F9B83]' : isWarning ? 'bg-[#B28A52]' : 'bg-[#A76565]';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs">
      <span className="relative flex">
        {pulse && isHealthy && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${dotColor}`} />
      </span>
      <span className="text-[#F2EEE4] uppercase tracking-wider">{label || status}</span>
    </div>
  );
};
