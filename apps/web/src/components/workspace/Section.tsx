import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  description,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-28", className)} aria-labelledby={`${id}-title`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground text-pretty">
              {description}
            </p>
          )}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-muted-foreground/20 bg-card/40 p-8 text-center" aria-live="polite">
      {icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
