import type { ReactNode } from "react";

type Row = { label: string; value: string; swatch?: string };

/**
 * Themed tooltip surface shared by every Recharts chart. Text uses ink tokens
 * (never the series color); an optional swatch carries series identity.
 */
export function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {children}
    </div>
  );
}

export function TooltipRows({ rows }: { rows: Row[] }) {
  return (
    <TooltipShell>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 whitespace-nowrap">
          {r.swatch && (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: r.swatch }}
            />
          )}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto font-medium tabular-nums text-popover-foreground">
            {r.value}
          </span>
        </div>
      ))}
    </TooltipShell>
  );
}

export function fmt(v: unknown, digits = 3): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(digits);
}
