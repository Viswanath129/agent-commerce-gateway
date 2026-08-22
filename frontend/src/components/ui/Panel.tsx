import React from "react";

export interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}) => {
  return (
    <div className={`border border-outline-variant/30 bg-surface-container-lowest flex flex-col ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-outline-variant/20 p-4">
          <div className="flex flex-col">
            {title && <div className="font-bodoni text-lg text-on-surface">{title}</div>}
            {subtitle && <div className="text-[11px] font-mono-jb text-on-surface-variant/70">{subtitle}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={`p-4 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
};
