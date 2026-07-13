import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Cpu,
  Database,
  Download,
  Eraser,
  FileText,
  LayoutDashboard,
  Trophy,
  Train,
} from "lucide-react";

import { getProfile, createRun, streamRun, uploadDataset, type ProfileResponse, type RunResult } from "@/lib/api/client";

import { SectionNav, MobileSectionNav, type NavItem } from "@/components/workspace/SectionNav";
import OverviewSection from "@/components/workspace/sections/OverviewSection";
import DatasetSection from "@/components/workspace/sections/DatasetSection";
import CleaningSection from "@/components/workspace/sections/CleaningSection";
import PreprocessingSection from "@/components/workspace/sections/PreprocessingSection";
import TrainingSection from "@/components/workspace/sections/TrainingSection";
import LeaderboardSection from "@/components/workspace/sections/LeaderboardSection";
import VisualizationsSection from "@/components/workspace/sections/VisualizationsSection";
import ReportsSection from "@/components/workspace/sections/ReportsSection";
import DownloadsSection from "@/components/workspace/sections/DownloadsSection";
import type { DatasetResponse } from "@/lib/api/client";

export default function Workspace() {
  const [data, setData] = useState<DatasetResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [target, setTarget] = useState<string>("");
  const [problemType, setProblemType] = useState<string | null>(null);

  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<{ name: string; explanation: string; pct: number }[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);

  const [active, setActive] = useState("overview");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          setActive((prev) => (id !== prev ? id : prev));
        }
      },
      { rootMargin: "-88px 0px -55% 0px", threshold: [0, 1] }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [data, result]);

  const setRef = (id: string, el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  const navItems: NavItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, enabled: true },
    { id: "dataset", label: "Dataset", icon: Database, enabled: !!data },
    { id: "training", label: "Training", icon: Train, enabled: !!data },
    { id: "cleaning", label: "Cleaning", icon: Eraser, enabled: !!result },
    { id: "preprocessing", label: "Preprocessing", icon: Cpu, enabled: !!result },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy, enabled: !!result },
    { id: "visualizations", label: "Visualizations", icon: BarChart3, enabled: !!result },
    { id: "reports", label: "Reports", icon: FileText, enabled: !!result },
    { id: "downloads", label: "Downloads", icon: Download, enabled: !!result },
  ];

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Please choose a .csv file.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setData(null);
    setProfile(null);
    setProfileError(null);
    setResult(null);
    setProblemType(null);
    setSteps([]);
    setProgress(0);
    try {
      const ds = await uploadDataset(file);
      setData(ds);
      setTarget(ds.columns[ds.columns.length - 1]?.name ?? "");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const controller = new AbortController();
    setProfile(null);
    setProfileError(null);
    getProfile(data.id, controller.signal)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        if (p.suggested_target) setTarget(p.suggested_target);
      })
      .catch((err) => {
        if (cancelled || err?.name === "AbortError") return;
        setProfileError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data]);

  async function train() {
    if (!data || !target) return;
    setTraining(true);
    setProgress(0);
    setSteps([]);
    setResult(null);
    setRunError(null);
    setProblemType(null);

    let source: EventSource | null = null;
    try {
      const { run_id } = await createRun(data.id, target);
      runIdRef.current = run_id;
      source = streamRun(run_id, {
        onEvent: (ev) => {
          if (ev.type === "step") {
            setProgress(ev.pct);
            setSteps((prev) => [...prev, { name: ev.name, explanation: ev.explanation, pct: ev.pct }]);
          } else if (ev.type === "result") {
            setResult(ev.result);
            setProblemType(ev.result.problem_type);
          } else if (ev.type === "done") {
            source?.close();
            setTraining(false);
          } else if (ev.type === "error") {
            setRunError(ev.message);
            source?.close();
            setTraining(false);
          }
        },
        onError: (err) => {
          if (training && !result) {
            setRunError(err instanceof Error ? err.message : "Training stream lost.");
          }
          source?.close();
          setTraining(false);
        },
      });
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
      setTraining(false);
    }
  }

  function navigate(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
      <SectionNav items={navItems} active={active} onNavigate={navigate} />

      <div className="min-w-0 space-y-8">
        <MobileSectionNav items={navItems} active={active} onNavigate={navigate} />

        <div ref={(el) => setRef("overview", el)}>
          <OverviewSection
            data={data}
            profile={profile}
            result={result}
            uploading={uploading}
            training={training}
            onFile={handleFile}
            onNavigate={navigate}
          />
        </div>

        {uploadError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {uploadError}
          </div>
        )}

        <div ref={(el) => setRef("dataset", el)}>
          <DatasetSection data={data} profile={profile} profileError={profileError} target={target} />
        </div>

        <div ref={(el) => setRef("training", el)}>
          <TrainingSection
            data={data}
            target={target}
            problemType={problemType}
            training={training}
            progress={progress}
            steps={steps}
            runError={runError}
            result={result}
            onTargetChange={setTarget}
            onTrain={train}
            onNavigate={navigate}
          />
        </div>

        <div ref={(el) => setRef("cleaning", el)}>
          <CleaningSection cleaning={result?.cleaning ?? null} />
        </div>

        <div ref={(el) => setRef("preprocessing", el)}>
          <PreprocessingSection cleaning={result?.cleaning ?? null} />
        </div>

        <div ref={(el) => setRef("leaderboard", el)}>
          <LeaderboardSection result={result} />
        </div>

        <div ref={(el) => setRef("visualizations", el)}>
          <VisualizationsSection evaluation={result?.evaluation ?? null} problemType={problemType ?? "classification"} />
        </div>

        <div ref={(el) => setRef("reports", el)}>
          <ReportsSection result={result} runId={runIdRef.current} />
        </div>

        <div ref={(el) => setRef("downloads", el)}>
          <DownloadsSection result={result} runId={runIdRef.current} />
        </div>
      </div>
    </div>
  );
}
