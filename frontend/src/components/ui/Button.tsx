import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  disabled,
  className = "",
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-mono-jb uppercase tracking-wider font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

  const variantStyles = {
    primary: "bg-primary text-on-primary border border-primary hover:bg-primary/90 shadow-sm",
    secondary: "bg-surface-container text-on-surface border border-outline-variant/40 hover:border-primary/60 hover:text-primary",
    outline: "bg-transparent text-primary border border-primary/40 hover:bg-primary/10",
    danger: "bg-error/10 text-error border border-error/30 hover:bg-error/20",
    ghost: "bg-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/40 border border-transparent",
  }[variant];

  const sizeStyles = {
    sm: "text-[10px] px-2.5 py-1 gap-1.5",
    md: "text-xs px-3.5 py-2 gap-2",
    lg: "text-sm px-5 py-2.5 gap-2.5",
  }[size];

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
