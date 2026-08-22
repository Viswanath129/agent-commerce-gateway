import React from "react";

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "rect",
  width,
  height,
}) => {
  const variantStyles = {
    text: "h-3.5 w-full rounded",
    rect: "w-full rounded-none",
    circle: "rounded-full aspect-square",
  }[variant];

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      style={style}
      className={`bg-surface-container-high/40 animate-pulse border border-outline-variant/10 ${variantStyles} ${className}`}
      aria-hidden="true"
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 6 }) => {
  return (
    <div className="border border-outline-variant/30 bg-surface-container-lowest p-4 space-y-3">
      <div className="grid grid-cols-6 gap-4 border-b border-outline-variant/20 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={14} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid grid-cols-6 gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={16} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const MetricStripSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 bg-surface-container-low border border-outline-variant/20 space-y-2">
          <Skeleton width="40%" height={12} />
          <Skeleton width="70%" height={32} />
          <Skeleton width="50%" height={10} />
        </div>
      ))}
    </div>
  );
};
