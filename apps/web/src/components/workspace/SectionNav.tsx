import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
};

/** Sticky vertical section rail (desktop). Disabled items are dimmed until
 *  their data exists. The active item is derived from scroll position. */
export function SectionNav({
  items,
  active,
  onNavigate,
}: {
  items: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-20 hidden max-h-[calc(100vh-6rem)] flex-col gap-0.5 self-start overflow-y-auto lg:flex"
    >
      <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sections
      </p>
      {items.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => it.enabled && onNavigate(it.id)}
            disabled={!it.enabled}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "press group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-200",
                isActive ? "opacity-100" : "opacity-0"
              )}
              aria-hidden
            />
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Horizontal scrollable pills for narrow screens, sticky under the navbar. */
export function MobileSectionNav({
  items,
  active,
  onNavigate,
}: {
  items: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-14 z-30 -mx-4 mb-2 border-b bg-background/80 px-4 py-2 backdrop-blur lg:hidden"
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items
          .filter((it) => it.enabled)
          .map((it) => {
            const isActive = active === it.id;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onNavigate(it.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "press shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                  isActive
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {it.label}
              </button>
            );
          })}
      </div>
    </nav>
  );
}
