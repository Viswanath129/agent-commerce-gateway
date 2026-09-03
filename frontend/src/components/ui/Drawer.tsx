import React, { useEffect } from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'max-w-2xl',
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
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#10100F]/80 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div className={`w-screen ${width} bg-[#141412] border-l border-[#302F2B] p-6 flex flex-col shadow-2xl overflow-y-auto`}>
          <div className="flex items-center justify-between border-b border-[#302F2B] pb-4 mb-6">
            <h2 className="font-display text-2xl text-[#F2EEE4] font-normal">{title}</h2>
            <button
              onClick={onClose}
              className="text-xs font-mono uppercase text-[#77746C] hover:text-[#F2EEE4] px-2 py-1 border border-[#302F2B] hover:border-[#C8B27A]"
            >
              [ESC] CLOSE
            </button>
          </div>
          <div className="flex-1 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
