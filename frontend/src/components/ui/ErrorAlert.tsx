import React from "react";
import { ApiError } from "../../lib/api/apiClient.js";

export interface ErrorAlertProps {
  error: ApiError | Error | null;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ error, onDismiss, className = "" }) => {
  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 0;
  const errorCode = isApiError ? error.errorCode : undefined;

  let title = "Execution Error";
  let explanation = error.message;
  let severity: "error" | "warning" = "error";

  if (statusCode === 403 || errorCode === "MANDATE_BUDGET_EXCEEDED") {
    title = "403 SECURITY INTERCEPTION: MANDATE BUDGET OVERSTEP";
    explanation = "The proposed item total exceeds the cryptographic mandate limit set by the human principal. The gateway blocked execution before calling Razorpay.";
    severity = "warning";
  } else if (statusCode === 409 || errorCode === "MANDATE_EXHAUSTED") {
    title = "409 CONCURRENCY CONTROL: MANDATE EXHAUSTED";
    explanation = "Dual subagent concurrency race detected. The ACID reservation engine locked the remaining balance to the first arrival, rejecting the second subagent.";
    severity = "warning";
  } else if (statusCode === 401 || errorCode === "INVALID_WEBHOOK_SIGNATURE") {
    title = "401 AUTHENTICATION FAILURE: FORGED WEBHOOK SIGNATURE";
    explanation = "The incoming webhook signature failed timing-safe HMAC-SHA256 verification against the merchant secret. Dropped before state mutation.";
    severity = "error";
  } else if (statusCode >= 500) {
    title = "500 GATEWAY FAULT";
    explanation = "Internal subsystem error occurred. Consult server audit logs or check database connectivity.";
    severity = "error";
  }

  return (
    <div
      className={`border p-4 text-xs font-mono-jb space-y-2 animate-fadeIn ${
        severity === "error"
          ? "bg-error/10 border-error/40 text-error"
          : "bg-tertiary/10 border-tertiary/40 text-tertiary"
      } ${className}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base">
            {severity === "error" ? "gpp_bad" : "shield"}
          </span>
          <strong className="uppercase font-bold">{title}</strong>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="hover:opacity-70 text-sm font-bold">
            &times;
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-on-surface">{explanation}</p>
      {error.message && (
        <div className="text-[10px] opacity-75 border-t border-current/20 pt-1 font-mono-jb">
          Raw Message: {error.message}
        </div>
      )}
    </div>
  );
};
