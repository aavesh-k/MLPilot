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
      description="Profiled automatically after upload — types, missingness, balance, and numeric correlations."
    >
      {profileError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Could not profile dataset: {profileError}
        </div>
      ) : !profile ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          <Spinner /> Profiling your dataset…
        </div>
      ) : (
        <div className="reveal">
          <DatasetProfileView profile={profile} target={target} />
        </div>
      )}

      {/* Raw preview */}
      <div className="mt-4 rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">
            Preview{" "}
            <span className="text-muted-foreground">· first {data.preview.length} rows</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          {data.preview.length > 0 ? (
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
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No rows to preview.</p>
          )}
        </div>
      </div>
    </Section>
  );
}
