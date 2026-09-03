import React from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'NO RECORDS FOUND',
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="glass-panel rounded-lg p-10 text-center font-mono text-xs text-[#BCB7AB] animate-pulse flex items-center justify-center gap-3">
        <span className="w-2 h-2 rounded-full bg-[#C8B27A] animate-ping" />
        <span>QUERYING SYSTEM LEDGER STATE...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass-panel rounded-lg p-12 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        <div className="font-mono text-xs uppercase tracking-widest text-[#BCB7AB]">
          {emptyMessage}
        </div>
        <div className="font-ui text-xs text-[#7A776F] mt-1.5">
          Zero-Mock: View reflects authoritative SQLite database state.
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden glass-panel rounded-lg border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${className}`}>
      {/* Specular top rim shine */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06] bg-[#141412]/80 backdrop-blur-md text-[#7A776F] uppercase tracking-wider text-[10px]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3.5 font-medium ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {data.map((item, idx) => (
              <tr
                key={item.id || item.intent_id || item.mandate_id || idx}
                onClick={() => onRowClick && onRowClick(item)}
                className={`transition-colors duration-150 group ${
                  onRowClick ? 'cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]' : 'hover:bg-white/[0.015]'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                  >
                    {col.render ? col.render(item, idx) : item[col.key] !== undefined ? String(item[col.key]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
