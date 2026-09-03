import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass' | 'glassProminent';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-mono text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-[#C8B27A] active:scale-[0.97] select-none rounded-md overflow-hidden';

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[#C8B27A] text-[#10100F] font-semibold hover:bg-[#E4D5B0] active:bg-[#B8A36C] border border-[#C8B27A] shadow-[0_2px_12px_rgba(200,178,122,0.25)]',
    secondary:
      'bg-[#1C1C19] text-[#F4F0E6] hover:bg-[#252522] hover:text-[#FFFFFF] border border-[#2D2C28] active:bg-[#141412]',
    outline:
      'bg-transparent text-[#F4F0E6] hover:bg-white/[0.04] hover:border-[#C8B27A]/60 border border-[#2D2C28]',
    ghost:
      'bg-transparent text-[#BCB7AB] hover:text-[#F4F0E6] hover:bg-white/[0.04] border border-transparent',
    danger:
      'bg-[#A76565]/20 text-[#A76565] border border-[#A76565]/50 hover:bg-[#A76565]/30 active:bg-[#A76565]/40 shadow-[0_2px_12px_rgba(167,101,101,0.2)]',
    glass:
      'bg-[rgba(24,24,22,0.55)] text-[#F4F0E6] backdrop-blur-md border border-white/10 hover:border-[#C8B27A]/40 hover:bg-[rgba(32,32,28,0.75)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_4px_16px_rgba(0,0,0,0.4)] active:bg-[rgba(20,20,18,0.85)]',
    glassProminent:
      'bg-[rgba(200,178,122,0.18)] text-[#E4D5B0] font-semibold backdrop-blur-md border border-[#C8B27A]/40 hover:bg-[rgba(200,178,122,0.28)] hover:border-[#C8B27A]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_0_20px_rgba(200,178,122,0.2)] active:bg-[rgba(200,178,122,0.14)]',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    xs: 'px-2.5 py-1 text-[10px] gap-1',
    sm: 'px-3 py-1.5 text-[11px] gap-1.5',
    md: 'px-4 py-2 text-xs gap-2',
    lg: 'px-6 py-2.5 text-sm gap-2.5',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {/* Specular top rim shine */}
      <span className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      <span className="relative z-10">{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
