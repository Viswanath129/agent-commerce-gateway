import React from "react";

export interface MetricProps {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  variant?: "primary" | "secondary" | "error" | "neutral";
  className?: string;
}

export const Metric: React.FC<MetricProps> = ({
  label,
  value,
  subtext,
  variant = "primary",
  className = "",
}) => {
  const valueColors = {
    primary: "text-primary",
    secondary: "text-secondary",
    error: "text-error",
    neutral: "text-on-surface",
  }[variant];

  return (
    <div className={`flex flex-col gap-1 p-4 bg-surface-container-low border border-outline-variant/20 ${className}`}>
      <span className="text-[11px] font-mono-jb text-on-surface-variant uppercase tracking-widest">{label}</span>
      <div className={`font-mono-jb text-3xl mt-1 font-semibold ${valueColors}`}>{value}</div>
      {subtext && <span className="text-xs font-mono-jb text-on-surface-variant/70 mt-1">{subtext}</span>}
    </div>
  );
};
