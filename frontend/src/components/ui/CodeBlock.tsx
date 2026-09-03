import React, { useState } from 'react';

export interface CodeBlockProps {
  title?: string;
  code: string;
  language?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  title,
  code,
  language = 'json',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`border border-[#302F2B] bg-[#10100F] ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-[#141412] border-b border-[#302F2B] text-[10px] font-mono text-[#77746C]">
        <span className="uppercase">{title || language}</span>
        <button
          onClick={handleCopy}
          className="hover:text-[#F2EEE4] text-[#C8B27A] transition-colors"
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono text-[#B8B3A7] overflow-x-auto leading-relaxed max-h-72">
        <code>{code}</code>
      </pre>
    </div>
  );
};
