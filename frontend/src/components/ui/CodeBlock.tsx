import React, { useState } from "react";

export interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "json",
  title,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`border border-outline-variant/30 bg-surface-container-lowest ${className}`}>
      <div className="flex items-center justify-between border-b border-outline-variant/20 px-3 py-2 bg-surface-container-low">
        <span className="text-[10px] font-mono-jb text-on-surface-variant uppercase tracking-widest font-semibold">
          {title || language}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] font-mono-jb text-primary hover:text-primary/80 uppercase font-semibold transition-colors"
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono-jb text-on-surface-variant overflow-x-auto leading-relaxed max-h-96">
        <code>{code}</code>
      </pre>
    </div>
  );
};
