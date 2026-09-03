import React from 'react';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`relative flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-6 ${className}`}>
      <div className="space-y-2 max-w-3xl">
        {eyebrow && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#C8B27A] uppercase tracking-widest font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8B27A] shadow-[0_0_8px_rgba(200,178,122,0.6)]" />
            <span>{eyebrow}</span>
          </div>
        )}
        <h1 className="font-display text-3xl md:text-4xl text-[#F4F0E6] font-normal tracking-wide">
          {title}
        </h1>
        {description && (
          <p className="font-ui text-sm text-[#BCB7AB] leading-relaxed max-w-2xl font-light">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-3">{action}</div>}
    </div>
  );
};
