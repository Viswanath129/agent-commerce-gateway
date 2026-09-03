import React from 'react';

export interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'subtle' | 'glass';
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  variant = 'glass',
}) => {
  const panelStyles = {
    default: 'glass-panel rounded-lg',
    glass: 'glass-panel rounded-lg',
    elevated: 'glass-panel glass-panel-interactive rounded-lg',
    subtle: 'glass-panel-subtle rounded-lg',
  }[variant];

  return (
    <section className={`relative overflow-hidden ${panelStyles} p-5 md:p-6 transition-all duration-200 ${className}`}>
      {/* Specular top rim light reflection */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4 mb-5">
          <div>
            {title && (
              <h3 className="font-display text-lg md:text-xl font-normal text-[#F4F0E6] tracking-wide">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs font-mono text-[#BCB7AB] mt-0.5 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};
