import { Eraser } from "lucide-react";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import { Stat } from "@/components/workspace/Stat";
import type { CleaningSummary } from "@/lib/api/client";

export default function CleaningSection({ cleaning }: { cleaning: CleaningSummary | null }) {
  if (!cleaning) {
    return (
      <Section id="cleaning" title="Cleaning">
        <EmptyState
          icon={<Eraser className="size-5" />}
          title="Cleaning happens on training"
          hint="Once you train, we drop duplicates and constant columns and cap numeric outliers (1.5×IQR). The summary appears here."
        />
      </Section>
    );
  }

  return (
    <Section
      id="cleaning"
      title="Cleaning"
      description="Applied automatically before training — the data the models actually see."
    >
      <div className="reveal space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Rows"
            value={`${cleaning.rows_before.toLocaleString()} → ${cleaning.rows_after.toLocaleString()}`}
            tone={cleaning.rows_before !== cleaning.rows_after ? "warn" : "default"}
          />
          <Stat label="Duplicate rows" value={cleaning.dropped_dupes.toLocaleString()} />
          <Stat
            label="Columns dropped"
            value={String(cleaning.dropped_cols.length)}
            tone={cleaning.dropped_cols.length ? "warn" : "default"}
          />
          <Stat
            label="Columns capped"
            value={String(cleaning.capped_cols.length)}
            tone={cleaning.capped_cols.length ? "warn" : "default"}
          />
        </div>

        {(cleaning.dropped_cols.length > 0 || cleaning.capped_cols.length > 0) && (
          <div className="space-y-1.5 text-xs">
            {cleaning.dropped_cols.length > 0 && (
              <p className="text-muted-foreground">
                <span className="font-medium">Dropped (constant/empty):</span>{" "}
                <span className="text-foreground">{cleaning.dropped_cols.join(", ")}</span>
              </p>
            )}
            {cleaning.capped_cols.length > 0 && (
              <p className="text-muted-foreground">
                <span className="font-medium">Outliers capped (1.5×IQR):</span>{" "}
                <span className="text-foreground">
                  {cleaning.capped_cols.map((c) => `${c.col} (${c.count})`).join(", ")}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Imputation strategy</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-muted px-2.5 py-1">
              numeric → <span className="font-medium">{cleaning.impute_strategy.numeric ?? "—"}</span>
            </span>
            <span className="rounded-md bg-muted px-2.5 py-1">
              categorical →{" "}
              <span className="font-medium">{cleaning.impute_strategy.categorical ?? "—"}</span>
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
