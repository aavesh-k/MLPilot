import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import DatasetProfileView from "@/components/DatasetProfileView";
import { Spinner } from "@/components/ui/spinner";
import { formatValue } from "@/lib/format";
import { Database } from "lucide-react";
import type { DatasetResponse, ProfileResponse } from "@/lib/api/client";

export default function DatasetSection({
  data,
  profile,
  profileError,
  target,
}: {
  data: DatasetResponse | null;
  profile: ProfileResponse | null;
  profileError: string | null;
  target: string;
}) {
  if (!data) {
    return (
      <Section id="dataset" title="Dataset">
        <EmptyState
          icon={<Database className="size-5" />}
          title="No dataset yet"
          hint="Upload a CSV from the Overview to see its profile, types, and correlations."
        />
      </Section>
    );
  }

  return (
    <Section
      id="dataset"
      title="Dataset"
      description="Profiled automatically after upload \u2014 types, missingness, balance, and numeric correlations."
    >
      {profileError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          Could not profile dataset: {profileError}
        </div>
      ) : !profile ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          <Spinner /> Profiling your dataset\u2026
        </div>
      ) : (
        <div className="reveal">
          <DatasetProfileView profile={profile} target={target} />
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-sm font-medium">
            Preview{" "}
            <span className="text-muted-foreground font-normal">\u00B7 {data.preview.length} rows</span>
          </p>
        </div>
        {data.preview.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(data.preview[0]).map((k) => (
                    <TableHead key={k} className={k === target ? "text-primary" : ""}>
                      {k}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.preview.map((row, i) => (
                  <TableRow key={i}>
                    {Object.values(row).map((v, j) => (
                      <TableCell key={j} className="whitespace-nowrap tabular-nums">
                        {formatValue(v)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">No rows to preview.</p>
        )}
      </div>
    </Section>
  );
}
