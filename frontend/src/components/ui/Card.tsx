import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'subtle' | 'interactive' | 'solid';
  isGlow?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'glass', isGlow = false, children, ...props }, ref) => {
    const variantClasses = {
      glass: 'glass-panel rounded-lg',
      subtle: 'glass-panel-subtle rounded-lg',
      interactive: 'glass-panel glass-panel-interactive rounded-lg cursor-pointer',
      solid: 'bg-[#161614] border border-[#2D2C28] rounded-lg',
    }[variant];

    const glowClass = isGlow ? 'shadow-[0_0_30px_-4px_rgba(200,178,122,0.2)]' : '';

    return (
      <div
        ref={ref}
        className={`relative overflow-hidden transition-all duration-200 ${variantClasses} ${glowClass} ${className}`}
        {...props}
      >
        {/* Specular top rim light reflection */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col space-y-1.5 p-5 md:p-6 border-b border-white/[0.06] ${className}`}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3
      ref={ref}
      className={`font-display text-lg md:text-xl font-normal text-[#F4F0E6] tracking-wide ${className}`}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => (
    <p
      ref={ref}
      className={`text-xs font-mono text-[#BCB7AB] leading-relaxed ${className}`}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`p-5 md:p-6 ${className}`} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex items-center p-5 md:p-6 pt-0 border-t border-white/[0.04] ${className}`}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';