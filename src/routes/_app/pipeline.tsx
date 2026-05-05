import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kanban } from "lucide-react";
import { REGIONS, regionLabel } from "@/lib/regions";
import { toast } from "sonner";

import { CandidateActionDialog } from "@/components/CandidateActionDialog";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  stage: string;
  score: number;
  gender: string | null;
  job_id: string | null;
};

type Stage = { id: number; name: string; name_ar: string | null; color: string | null; display_order: number };
type Job = { id: string; region: string };

function PipelinePage() {
  const { lang, dir, t } = useI18n();
  const [stages, setStages] = useState<Stage[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [region, setRegion] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [dialogTab, setDialogTab] = useState<"evaluate" | "message">("evaluate");

  const reload = async () => {
    const [{ data: s }, { data: c }, { data: j }] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("display_order"),
      supabase.from("candidates").select("id,full_name,email,phone,stage,score,gender,job_id"),
      supabase.from("jobs").select("id,region"),
    ]);
    setStages((s ?? []) as Stage[]);
    setCandidates((c ?? []) as Candidate[]);
    const map: Record<string, Job> = {};
    (j ?? []).forEach((x) => (map[x.id] = x as Job));
    setJobs(map);
  };

  useEffect(() => {
    void reload();
  }, []);

  const visible = useMemo(() => {
    if (!region) return candidates;
    return candidates.filter((c) => c.job_id && jobs[c.job_id]?.region === region);
  }, [candidates, jobs, region]);

  const onDrop = async (stageName: string) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, stage: stageName } : c)));
    const { error } = await supabase.from("candidates").update({ stage: stageName }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const stageList = stages.length > 0
    ? stages
    : ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"].map((n, i) => ({
        id: i, name: n, name_ar: null, color: null, display_order: i,
      } as Stage));

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <Kanban className="h-7 w-7" />
          {t("pipeline")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {lang === "ar" ? "اسحب البطاقة لتغيير المرحلة." : "Drag a card to change stage."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRegion("")}
          className={`px-3 py-1.5 rounded-full text-xs border ${region === "" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
        >
          {lang === "ar" ? "كل المناطق" : "All regions"}
        </button>
        {REGIONS.map((r) => (
          <button
            key={r.region}
            onClick={() => setRegion(r.region)}
            className={`px-3 py-1.5 rounded-full text-xs border ${region === r.region ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
          >
            {regionLabel(r.region, lang)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 grid-flow-col auto-cols-[minmax(240px,1fr)] overflow-x-auto pb-4">
        {stageList.map((s) => {
          const items = visible.filter((c) => c.stage === s.name);
          return (
            <Card
              key={s.id}
              className="glass shadow-elegant p-3 min-h-[200px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(s.name)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm">
                  {lang === "ar" && s.name_ar ? s.name_ar : s.name}
                </div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    className="rounded-lg border bg-card/70 p-2.5 text-sm cursor-grab active:cursor-grabbing hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{c.full_name}</div>
                      {c.score > 0 && <Badge variant="outline">{c.score}</Badge>}
                    </div>
                    {c.gender && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.gender === "female"
                          ? lang === "ar" ? "أنثى" : "Female"
                          : lang === "ar" ? "ذكر" : "Male"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
});
