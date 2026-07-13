import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function Dropzone({
  onFile,
  loading,
  compact = false,
}: {
  onFile: (file: File) => void;
  loading?: boolean;
  compact?: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a CSV file"
      aria-busy={loading}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center outline-none transition-[border-color,background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)]",
        "focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.995]",
        compact ? "p-5" : "p-10 sm:p-14",
        dragActive
          ? "border-primary bg-primary/[0.06]"
          : "border-muted-foreground/20 hover:border-muted-foreground/35 hover:bg-accent/30"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:scale-110",
          compact ? "size-9" : "size-14"
        )}
      >
        {loading ? <Spinner /> : <UploadCloud className={compact ? "size-4" : "size-6"} />}
      </span>
      <div className="space-y-1">
        <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {loading
            ? "Uploading & profiling\u2026"
            : compact
              ? "Replace dataset"
              : "Drag & drop a CSV, or click to browse"}
        </p>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            We validate, profile, and preview it instantly \u00B7 .csv up to ~100\u00A0MB
          </p>
        )}
      </div>
    </div>
  );
}
