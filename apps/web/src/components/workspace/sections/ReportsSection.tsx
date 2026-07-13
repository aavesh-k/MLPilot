import { ArrowUpRight, FileText } from "lucide-react";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { downloadRunArtifact, type RunResult } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export default function ReportsSection({
  result,
  runId,
}: {
  result: RunResult | null;
  runId: string | null;
}) {
  if (!result || !runId) {
    return (
      <Section id="reports" title="Reports">
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No report yet"
          hint="After training, a plain-language Markdown report and a formatted PDF are generated automatically."
        />
      </Section>
    );
  }

  const sampleInsights = result.insights.slice(0, 2);

  return (
    <Section
      id="reports"
      title="Reports"
      description="Generated automatically after training \u2014 a readable summary plus a formatted PDF."
      aside={
        <a
          href={downloadRunArtifact(runId, "pdf")}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "press")}
        >
          <FileText className="size-4" /> Open PDF
        </a>
      }
    >
      <div className="reveal grid gap-4 md:grid-cols-2">
        <div className="surface-raised p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Run report</p>
            <Badge variant="secondary" className="capitalize">
              {result.problem_type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{result.target}</span> \u00B7{" "}
            {result.best_model}
          </p>
          {sampleInsights.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {sampleInsights.map((ins, i) => (
                <li key={i} className="line-clamp-2 text-pretty">
                  {ins}
                </li>
              ))}
            </ul>
          )}
          <a
            href={downloadRunArtifact(runId, "report")}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-auto w-fit press")}
          >
            View full report <ArrowUpRight className="size-4" />
          </a>
        </div>

        <div className="surface-raised p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">PDF report</p>
            {result.artifacts?.pdf ? (
              <Badge variant="default">Ready</Badge>
            ) : (
              <Badge variant="outline">Unavailable</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            A4-formatted document with the model comparison, top drivers, and cleaning summary.
          </p>
          <a
            href={result.artifacts?.pdf ? downloadRunArtifact(runId, "pdf") : "#"}
            aria-disabled={!result.artifacts?.pdf}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mt-auto w-fit press",
              !result.artifacts?.pdf && "pointer-events-none opacity-50"
            )}
          >
            Download PDF <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
    </Section>
  );
}
