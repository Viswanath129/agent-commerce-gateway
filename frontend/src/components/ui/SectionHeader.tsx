import React from "react";

export interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow = "Razorpay AI Buildathon — Track 01",
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant/20 pb-6 ${className}`}>
      <div className="flex flex-col gap-2 max-w-4xl">
        {eyebrow && (
          <div className="text-xs font-mono-jb text-primary tracking-widest uppercase font-semibold">
            {eyebrow}
          </div>
        )}
        <h1 className="font-bodoni text-4xl md:text-5xl text-primary tracking-tight font-normal uppercase leading-tight">
          {title}
        </h1>
        {description && (
          <p className="font-cormorant text-2xl text-on-surface-variant italic mt-1">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};
