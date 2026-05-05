import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";
import { REGIONS, regionLabel } from "@/lib/regions";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  stage: string;
  status: string;
  score: number;
  screening_result: string | null;
  job_id: string | null;
  notes: string | null;
  created_at: string;
};

type Job = { id: string; title: string; region: string };

function CandidatesPage() {
  const { t, lang, dir } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [region, setRegion] = useState<string>("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: j }] = await Promise.all([
        supabase.from("candidates").select("*").order("created_at", { ascending: false }),
        supabase.from("jobs").select("id,title,region"),
      ]);
      setCandidates((c ?? []) as Candidate[]);
      const map: Record<string, Job> = {};
      (j ?? []).forEach((x) => (map[x.id] = x as Job));
      setJobs(map);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (gender && c.gender !== gender) return false;
      if (region) {
        const job = c.job_id ? jobs[c.job_id] : null;
        if (!job || job.region !== region) return false;
      }
      if (q) {
        const s = q.toLowerCase();
        if (
          !c.full_name?.toLowerCase().includes(s) &&
          !c.email?.toLowerCase().includes(s) &&
          !(c.phone ?? "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [candidates, jobs, region, gender, q]);

  const byGender = (g: "male" | "female") => filtered.filter((c) => c.gender === g);

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <Users className="h-7 w-7" />
          {t("candidates")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {lang === "ar"
            ? "كل المرشحين، مفروزون تلقائياً حسب الجنس والمنطقة."
            : "All candidates, auto-sorted by gender and region."}
        </p>
      </div>

      <Card className="glass shadow-elegant p-4 space-y-4">
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
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === "ar" ? "بحث بالاسم أو البريد" : "Search by name or email"}
              className="ps-9"
            />
          </div>
          {(["", "male", "female"] as const).map((g) => (
            <button
              key={g || "all"}
              onClick={() => setGender(g)}
              className={`px-3 py-1.5 rounded-full text-xs border ${gender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {g === ""
                ? lang === "ar" ? "الكل" : "All"
                : g === "male"
                  ? lang === "ar" ? "بنين" : "Boys"
                  : lang === "ar" ? "بنات" : "Girls"}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(["male", "female"] as const).map((g) => (
          <Card key={g} className="glass shadow-elegant p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                {g === "male"
                  ? lang === "ar" ? "بنين" : "Boys"
                  : lang === "ar" ? "بنات" : "Girls"}
              </h2>
              <Badge variant="secondary">{byGender(g).length}</Badge>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loading && <div className="text-sm text-muted-foreground">…</div>}
              {!loading && byGender(g).length === 0 && (
                <div className="text-sm text-muted-foreground">{t("noData")}</div>
              )}
              {byGender(g).map((c) => {
                const job = c.job_id ? jobs[c.job_id] : null;
                return (
                  <div key={c.id} className="rounded-lg border bg-card/50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{c.full_name}</div>
                      <Badge variant="outline">{c.stage}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{c.email}</div>
                    {job && (
                      <div className="text-xs mt-1">
                        {job.title} · {regionLabel(job.region, lang)}
                      </div>
                    )}
                    {c.screening_result && (
                      <Badge variant="secondary" className="mt-2">
                        {c.screening_result}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/candidates")({
  component: CandidatesPage,
});
