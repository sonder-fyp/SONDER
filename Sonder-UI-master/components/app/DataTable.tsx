"use client";

import { cn } from "@/lib/utils";
import { SectionRule } from "@/components/type";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right";
};

/**
 * Editorial table: mono uppercase headers on a rule, hairline rows, one divider
 * direction, generous row height. The wrapper is the horizontal scroller so a
 * wide table scrolls inside itself at 390px and the page never does.
 *
 * Selection matches ListRow: a 2px accent rule on the left edge plus a muted
 * ground, never a colour wash alone. A clickable row also gets a
 * `--border-strong` rule on hover, so it reads as interactive before it is
 * selected; a non-clickable row gets neither cue.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  isRowSelected,
  caption,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  caption?: string;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (!rows.length && empty) return <>{empty}</>;

  return (
    <div className={cn("app-scroll w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[44rem] border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-t border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "label whitespace-nowrap py-4 pr-8 font-medium text-muted-foreground",
                  col.align === "right" && "pr-0 text-right",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
          <tr aria-hidden>
            <th colSpan={columns.length} className="p-0 font-normal">
              <SectionRule />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const selected = isRowSelected?.(row) ?? false;
            return (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "border-b border-border transition-colors duration-150",
                  onRowClick && "group cursor-pointer hover:bg-muted",
                  selected && "bg-muted",
                )}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={col.key}
                    className={cn(
                      "py-5 pr-8 align-middle text-base",
                      colIndex === 0 && "relative",
                      col.align === "right" && "pr-0 text-right",
                      col.className,
                    )}
                  >
                    {colIndex === 0 && onRowClick && !selected ? (
                      <span
                        aria-hidden
                        data-slot="row-hover"
                        className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors duration-150 ease-[var(--ease)] group-hover:bg-border-strong"
                      />
                    ) : null}
                    {colIndex === 0 && selected ? (
                      <span
                        aria-hidden
                        data-slot="row-accent"
                        className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                      />
                    ) : null}
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
