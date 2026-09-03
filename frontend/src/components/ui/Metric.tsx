import React from 'react';

export interface MetricProps {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  indicator?: 'live' | 'success' | 'danger' | 'warning' | 'neutral';
  delta?: string;
  className?: string;
}

export const Metric: React.FC<MetricProps> = ({
  label,
  value,
  subtext,
  indicator = 'neutral',
  delta,
  className = '',
}) => {
  const indicatorDot = {
    live: 'bg-[#C8B27A] animate-pulse shadow-[0_0_8px_rgba(200,178,122,0.6)]',
    success: 'bg-[#6F9B83] shadow-[0_0_8px_rgba(111,155,131,0.6)]',
    danger: 'bg-[#A76565] shadow-[0_0_8px_rgba(167,101,101,0.6)]',
    warning: 'bg-[#B28A52] shadow-[0_0_8px_rgba(178,138,82,0.6)]',
    neutral: 'bg-[#7A776F]',
  }[indicator];

  return (
    <div
      className={`relative overflow-hidden p-4 md:p-5 glass-panel glass-panel-interactive rounded-lg flex flex-col justify-between group select-none ${className}`}
    >
      {/* Specular top rim highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Subtle background glow */}
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-[#C8B27A]/[0.03] rounded-full blur-xl pointer-events-none group-hover:bg-[#C8B27A]/[0.06] transition-colors" />

      <div className="relative z-10 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#BCB7AB] mb-2">
        <span className="tracking-widest">{label}</span>
        <div className="flex items-center gap-1.5">
          {delta && (
            <span className="text-[#C8B27A] font-semibold text-[10px] bg-[#C8B27A]/10 px-1.5 py-0.5 rounded border border-[#C8B27A]/30">
              {delta}
            </span>
          )}
          <span className={`w-2 h-2 rounded-full ${indicatorDot}`} />
        </div>
      </div>

      <div className="relative z-10 font-mono text-2xl md:text-3xl text-[#F4F0E6] font-semibold tracking-tight my-1 group-hover:text-[#FFFFFF] transition-colors">
        {value}
      </div>

      {subtext && (
        <div className="relative z-10 text-[11px] font-mono text-[#7A776F] truncate mt-1 flex items-center gap-1">
          {subtext}
        </div>
      )}
    </div>
  );
};
