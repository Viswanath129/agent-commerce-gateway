import React from "react";
import { Button } from "./Button.js";

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({
  title = "No Data Found",
  description = "No records match the current view criteria.",
  action,
  className = "",
}) => (
  <div className={`p-8 text-center border border-outline-variant/20 bg-surface-container-low flex flex-col items-center justify-center gap-3 ${className}`}>
    <span className="material-symbols-outlined text-outline text-3xl">inbox</span>
    <div className="flex flex-col gap-1">
      <h4 className="font-bodoni text-lg text-on-surface">{title}</h4>
      <p className="text-xs font-mono-jb text-on-surface-variant max-w-sm">{description}</p>
    </div>
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const LoadingState: React.FC<{
  message?: string;
  className?: string;
}> = ({ message = "Synchronizing with Control Plane...", className = "" }) => (
  <div className={`p-12 text-center flex flex-col items-center justify-center gap-3 ${className}`}>
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-mono-jb text-on-surface-variant tracking-wider uppercase">{message}</span>
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  error?: string;
  onRetry?: () => void;
  className?: string;
}> = ({
  title = "Gateway Communication Error",
  error = "Failed to retrieve authoritative records from the server.",
  onRetry,
  className = "",
}) => (
  <div className={`p-6 text-center border border-error/30 bg-error/5 flex flex-col items-center justify-center gap-3 ${className}`}>
    <span className="material-symbols-outlined text-error text-3xl">error</span>
    <div className="flex flex-col gap-1">
      <h4 className="font-bodoni text-lg text-error">{title}</h4>
      <p className="text-xs font-mono-jb text-on-surface-variant max-w-md">{error}</p>
    </div>
    {onRetry && (
      <Button variant="danger" size="sm" onClick={onRetry}>
        Retry Request
      </Button>
    )}
  </div>
);
