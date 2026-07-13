import { cn } from "@/lib/utils";

type Tone = "default" | "warn" | "good" | "accent";

const toneBorder: Record<Tone, string> = {
  default: "",
  warn: "border-l-warning/30",
  good: "border-l-success/30",
  accent: "border-l-primary/40",
};

const toneText: Record<Tone, string> = {
  default: "",
  warn: "text-warning",
  good: "text-success",
  accent: "text-primary",
};

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
    <div className={cn("rounded-xl border bg-card p-3 shadow-sm", toneBorder[tone], className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-semibold tabular-nums", toneText[tone])} title={value}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
