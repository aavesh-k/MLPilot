import { Download, FileBox, FileSpreadsheet, FileText } from "lucide-react";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import { Badge } from "@/components/ui/badge";
import { downloadRunArtifact, type RunResult } from "@/lib/api/client";

type Artifact = {
  key: "model" | "predictions" | "report" | "pdf" | "cleaned";
  label: string;
  desc: string;
  icon: typeof Download;
  ext: string;
};

const ARTIFACTS: Artifact[] = [
  { key: "model", label: "Model", desc: "Fitted pipeline + estimator (.joblib)", icon: FileBox, ext: ".joblib" },
  { key: "predictions", label: "Predictions", desc: "Hold-out predictions (CSV)", icon: FileSpreadsheet, ext: ".csv" },
  { key: "report", label: "Report", desc: "Plain-language summary (Markdown)", icon: FileText, ext: ".md" },
  { key: "pdf", label: "PDF report", desc: "Formatted A4 report", icon: FileText, ext: ".pdf" },
  { key: "cleaned", label: "Cleaned CSV", desc: "Post-cleaning dataset", icon: FileSpreadsheet, ext: ".csv" },
];

export default function DownloadsSection({
  result,
  runId,
}: {
  result: RunResult | null;
  runId: string | null;
}) {
  if (!result || !runId) {
    return (
      <Section id="downloads" title="Downloads">
        <EmptyState
          icon={<Download className="size-5" />}
          title="Nothing to download yet"
          hint="Every run artifact lands here: the model, predictions, cleaned data, report, and PDF."
        />
      </Section>
    );
  }

  const available = (k: Artifact["key"]) =>
    k === "pdf" ? !!result.artifacts?.pdf : k === "cleaned" ? !!result.artifacts?.cleaned : true;

  return (
    <Section
      id="downloads"
      title="Downloads"
      description="Everything produced by this run, ready to take offline."
    >
      <div className="reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ARTIFACTS.map((a) => {
          const Icon = a.icon;
          const ready = available(a.key);
          return (
            <a
              key={a.key}
              href={ready ? downloadRunArtifact(runId, a.key) : "#"}
              aria-disabled={!ready}
              className="press flex flex-col gap-2 surface-raised p-4 transition-[border-color,background-color,transform] hover:border-primary/40 hover:bg-accent/30 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                {ready ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Download className="size-3.5" /> {a.ext}
                  </span>
                ) : (
                  <Badge variant="outline">N/A</Badge>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-xs text-muted-foreground text-pretty">{a.desc}</p>
              </div>
            </a>
          );
        })}
      </div>
    </Section>
  );
}
