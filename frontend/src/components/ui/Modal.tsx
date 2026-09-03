import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#10100F]/85 backdrop-blur-sm"
      />
      <div className="relative bg-[#181816] border border-[#302F2B] max-w-lg w-full p-6 space-y-5 shadow-2xl z-10">
        <div className="flex items-center justify-between border-b border-[#302F2B] pb-3">
          <h3 className="font-display text-xl text-[#F2EEE4]">{title}</h3>
          <button
            onClick={onClose}
            className="text-xs font-mono text-[#77746C] hover:text-[#F2EEE4]"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && (
          <div className="pt-3 border-t border-[#302F2B] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
