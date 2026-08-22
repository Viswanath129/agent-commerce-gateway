import React from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = "",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 w-full max-w-lg border border-outline-variant/40 bg-surface-container-lowest shadow-2xl p-6 space-y-4 ${className}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <h3 className="font-bodoni text-xl text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary transition-colors text-lg font-mono-jb"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="border-t border-outline-variant/20 pt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};
