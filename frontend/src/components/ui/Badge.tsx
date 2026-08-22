import React from "react";

export interface BadgeProps {
  variant?: "gold" | "success" | "warning" | "error" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "gold",
  size = "md",
  dot = false,
  children,
  className = "",
}) => {
  const variantStyles = {
    gold: "bg-primary/10 text-primary border-primary/30",
    success: "bg-secondary/10 text-secondary border-secondary/30",
    warning: "bg-tertiary/10 text-tertiary border-tertiary/30",
    error: "bg-error/10 text-error border-error/30",
    neutral: "bg-surface-container-high text-on-surface-variant border-outline-variant/30",
  }[variant];

  const sizeStyles = {
    sm: "text-[9px] px-1.5 py-0.5",
    md: "text-[10px] px-2 py-0.5",
  }[size];

  const dotColors = {
    gold: "bg-primary",
    success: "bg-secondary",
    warning: "bg-tertiary",
    error: "bg-error",
    neutral: "bg-outline",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono-jb uppercase tracking-wider font-semibold border ${variantStyles} ${sizeStyles} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors} animate-pulse`} />}
      <span>{children}</span>
    </span>
  );
};
