import { cn } from "@/lib/utils";

type Tone = "default" | "warn" | "good" | "accent";

const toneRing: Record<Tone, string> = {
  default: "",
  warn: "border-amber-500/40",
  good: "border-emerald-500/40",
  accent: "border-primary/40",
};

const toneText: Record<Tone, string> = {
  default: "",
  warn: "text-amber-600 dark:text-amber-400",
  good: "text-emerald-600 dark:text-emerald-400",
  accent: "text-primary",
};

/** A compact metric tile. `hint` shows a secondary line under the value. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3", toneRing[tone], className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-semibold tabular-nums", toneText[tone])} title={value}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
