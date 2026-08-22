import React from "react";

export interface StatusIndicatorProps {
  status: "LIVE" | "READY" | "CONNECTED" | "DEGRADED" | "DISCONNECTED" | "ERROR" | string;
  label?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className = "",
}) => {
  const isHealthy = ["LIVE", "READY", "CONNECTED", "HEALTHY", "INTEGRITY_VERIFIED"].includes(status.toUpperCase());
  const isWarning = ["DEGRADED", "MANUAL_REVIEW"].includes(status.toUpperCase());

  const dotColor = isHealthy ? "bg-secondary" : isWarning ? "bg-tertiary" : "bg-error";
  const textColor = isHealthy ? "text-secondary" : isWarning ? "text-tertiary" : "text-error";

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono-jb text-xs ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor} ${isHealthy ? "animate-pulse" : ""}`} />
      <span className={`font-semibold ${textColor}`}>{label || status}</span>
    </div>
  );
};
