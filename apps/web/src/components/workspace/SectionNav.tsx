import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
};

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
      <p className="px-3 pb-2 text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground">
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
              "press flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-[transform,background-color,color]",
              "disabled:cursor-not-allowed disabled:opacity-30",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

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
      className="sticky top-14 z-sticky -mx-4 mb-4 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-sm lg:hidden"
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
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
                  "press shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-[transform,background-color,color,border-color]",
                  isActive
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
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
