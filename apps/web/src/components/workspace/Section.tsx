import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A dashboard section with an anchor id (for the section nav), a title row, and
 * an optional aside (badges/actions). `scroll-mt` offsets the sticky navbar so
 * anchored jumps don't hide the heading.
 */
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
    <section id={id} className={cn("scroll-mt-24", className)} aria-labelledby={`${id}-title`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 max-w-prose text-sm text-muted-foreground text-pretty">
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

/** A quiet placeholder shown before a section has data. */
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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/40 p-10 text-center">
      {icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
