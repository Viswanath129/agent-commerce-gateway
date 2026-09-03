import React from 'react';

export type BadgeVariant =
  | 'live'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'reconciliation'
  | 'accent'
  | 'neutral'
  | 'glass';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  icon,
  size = 'md',
  pulse = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    live: 'bg-[#6F9B83]/15 text-[#6F9B83] border-[#6F9B83]/40 shadow-[0_0_12px_rgba(111,155,131,0.2)]',
    success: 'bg-[#6F9B83]/15 text-[#6F9B83] border-[#6F9B83]/40 shadow-[0_0_12px_rgba(111,155,131,0.2)]',
    danger: 'bg-[#A76565]/15 text-[#A76565] border-[#A76565]/40 shadow-[0_0_12px_rgba(167,101,101,0.2)]',
    warning: 'bg-[#B28A52]/15 text-[#B28A52] border-[#B28A52]/40 shadow-[0_0_12px_rgba(178,138,82,0.2)]',
    info: 'bg-[#73889A]/15 text-[#73889A] border-[#73889A]/40 shadow-[0_0_12px_rgba(115,136,154,0.2)]',
    reconciliation: 'bg-[#8A819C]/15 text-[#8A819C] border-[#8A819C]/40 shadow-[0_0_12px_rgba(138,129,156,0.2)]',
    accent: 'bg-[#C8B27A]/15 text-[#C8B27A] border-[#C8B27A]/40 shadow-[0_0_12px_rgba(200,178,122,0.2)]',
    neutral: 'bg-[#1C1C19]/80 text-[#BCB7AB] border-[#2D2C28]',
    glass: 'bg-white/[0.05] text-[#F4F0E6] border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]',
  };

  const dotColors: Record<BadgeVariant, string> = {
    live: 'bg-[#6F9B83]',
    success: 'bg-[#6F9B83]',
    danger: 'bg-[#A76565]',
    warning: 'bg-[#B28A52]',
    info: 'bg-[#73889A]',
    reconciliation: 'bg-[#8A819C]',
    accent: 'bg-[#C8B27A]',
    neutral: 'bg-[#7A776F]',
    glass: 'bg-white/60',
  };

  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]';

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 font-mono uppercase tracking-widest font-medium border rounded-full backdrop-blur-md select-none transition-all duration-150 ${variantStyles[variant]} ${sizeStyles} ${className}`}
    >
      {/* Specular top rim */}
      <span className="absolute inset-x-1 top-0 h-[0.5px] bg-white/20 pointer-events-none" />

      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColors[variant]}`} />
        </span>
      )}

      {icon}
      <span>{children}</span>
    </span>
  );
};
