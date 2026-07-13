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
          hint="Once you train, we drop duplicates and constant columns and cap numeric outliers (1.5\u00d7IQR). The summary appears here."
        />
      </Section>
    );
  }

  return (
    <Section
      id="cleaning"
      title="Cleaning"
      description="Applied automatically before training \u2014 the data the models actually see."
    >
      <div className="reveal space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger">
          <Stat
            label="Rows"
            value={`${cleaning.rows_before.toLocaleString()} \u2192 ${cleaning.rows_after.toLocaleString()}`}
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
                <span className="font-medium">Outliers capped (1.5\u00d7IQR):</span>{" "}
                <span className="text-foreground">
                  {cleaning.capped_cols.map((c) => `${c.col} (${c.count})`).join(", ")}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium">Imputation strategy</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-muted px-3 py-1.5">
              numeric \u2192 <span className="font-medium">{cleaning.impute_strategy.numeric ?? "\u2014"}</span>
            </span>
            <span className="rounded-lg bg-muted px-3 py-1.5">
              categorical \u2192{" "}
              <span className="font-medium">{cleaning.impute_strategy.categorical ?? "\u2014"}</span>
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
