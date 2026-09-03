import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`p-10 md:p-16 border border-[#302F2B] bg-[#181816] text-center space-y-3 ${className}`}>
      <div className="font-mono text-xs uppercase tracking-widest text-[#77746C] font-semibold">
        {title}
      </div>
      {description && (
        <p className="font-ui text-xs text-[#77746C] max-w-md mx-auto leading-relaxed font-light">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
