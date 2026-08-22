import React from "react";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyMessage = "No records found.",
  className = "",
}: DataTableProps<T>): React.ReactElement {
  return (
    <div className={`overflow-x-auto w-full border border-outline-variant/30 bg-surface-container-lowest ${className}`}>
      <table className="w-full text-left border-collapse min-w-[750px]">
        <thead>
          <tr className="text-[11px] font-mono-jb text-on-surface-variant border-b border-outline-variant/30 uppercase tracking-widest bg-surface-container-low">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`p-3 font-medium ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-xs font-mono-jb text-on-surface divide-y divide-outline-variant/10">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-on-surface-variant">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Loading data...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-on-surface-variant">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={keyExtractor(row, idx)}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${onRowClick ? "hover:bg-surface-container-low cursor-pointer" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.className || ""}`}
                  >
                    {col.render ? col.render(row, idx) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
