import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, X, Download } from "lucide-react";
import { exportJobsToXlsx } from "@/lib/exportJobsXlsx";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { MapPin, Calendar as CalendarIcon, Users, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/_app/jobs")({ component: JobsPage });

type Job = {
  id: string;
  job_code: string;
  title: string;
  region: string;
  branch: string;
  headcount: number;
  hired_count: number;
  status: string;
  priority: string;
  description?: string | null;
  opened_at?: string | null;
  target_fill_date?: string | null;
  created_at?: string | null;
};

const REGION_ORDER = [
  "Riyadh", "Jeddah", "Qassim", "Eastern Province", "Madinah",
  "Hail", "Abha", "Al-Ahsa", "Makkah", "Jazan",
];
const BRANCH_ORDER = ["Headquarters", "Boys School", "Girls School"];

const STATUS_OPTIONS = ["Open", "Filled", "On Hold"];
const PRIORITY_OPTIONS = ["High", "Normal"];

function JobsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [priorities, setPriorities] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "priority" | "region" | "branch" | "remaining" | "hired">("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Job[];
    },
  });

  const allJobs = data ?? [];

  const filteredJobs = useMemo(() => {
    return allJobs.filter((j) => {
      if (statuses.size && !statuses.has(j.status)) return false;
      if (priorities.size && !priorities.has(j.priority)) return false;
      if (debouncedSearch) {
        const hay = `${j.title} ${j.job_code}`.toLowerCase();
        if (!hay.includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [allJobs, statuses, priorities, debouncedSearch]);

  const sortedJobs = useMemo(() => {
    if (sortBy === "default") return filteredJobs;
    const dir = sortDir === "asc" ? 1 : -1;
    const priorityRank = (p: string) => (p === "High" ? 0 : 1);
    const regionRank = (r: string) => {
      const i = REGION_ORDER.indexOf(r);
      return i === -1 ? 999 : i;
    };
    const branchRank = (b: string) => {
      const i = BRANCH_ORDER.indexOf(b);
      return i === -1 ? 999 : i;
    };
    const key = (j: Job): number | string => {
      switch (sortBy) {
        case "priority": return priorityRank(j.priority);
        case "region": return regionRank(j.region);
        case "branch": return branchRank(j.branch);
        case "remaining": return Math.max(0, j.headcount - j.hired_count);
        case "hired": return j.hired_count;
        default: return 0;
      }
    };
    return [...filteredJobs].sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      return a.title.localeCompare(b.title);
    });
  }, [filteredJobs, sortBy, sortDir]);

  const grouped = useMemo(() => {
    const byRegion = new Map<string, Map<string, Job[]>>();
    for (const j of filteredJobs) {
      if (!byRegion.has(j.region)) byRegion.set(j.region, new Map());
      const br = byRegion.get(j.region)!;
      if (!br.has(j.branch)) br.set(j.branch, []);
      br.get(j.branch)!.push(j);
    }
    const regions = REGION_ORDER.filter((r) => byRegion.has(r)).concat(
      [...byRegion.keys()].filter((r) => !REGION_ORDER.includes(r)),
    );
    return { byRegion, regions };
  }, [filteredJobs]);

  // Reset tab if filters wiped out the active region
  useEffect(() => {
    if (tab !== "all" && !grouped.regions.includes(tab)) setTab("all");
  }, [grouped.regions, tab]);

  const totals = useMemo(
    () => ({
      total: filteredJobs.length,
      open: filteredJobs.filter((j) => j.status === "Open").length,
      regions: new Set(filteredJobs.map((j) => j.region)).size,
      branches: new Set(filteredJobs.map((j) => `${j.region}|${j.branch}`)).size,
    }),
    [filteredJobs],
  );

  const visibleRegions =
    tab === "all" ? grouped.regions : grouped.regions.filter((r) => r === tab);

  const activeFilters =
    (debouncedSearch ? 1 : 0) + statuses.size + priorities.size;

  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  };

  const clearAll = () => {
    setSearch("");
    setStatuses(new Set());
    setPriorities(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{t("jobs")}</h1>
          <p className="text-muted-foreground">
            {ar ? "الطلبات الوظيفية المفتوحة — قطاع الشباب" : "Available Jobs — Youth Sector"}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <SummaryStat
            label={ar ? "إجمالي الشواغر" : "Total Vacancies"}
            value={totals.total}
            sub={activeFilters ? `${t("of")} ${allJobs.length}` : undefined}
            accent
          />
          <SummaryStat label={ar ? "مفتوح" : "Open"} value={totals.open} />
          <SummaryStat label={ar ? "المناطق" : "Regions"} value={totals.regions} />
          <SummaryStat label={ar ? "الفروع" : "Branches"} value={totals.branches} />
        </div>
      </div>

      {/* Filter toolbar */}
      <Card className="glass shadow-elegant p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="ps-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute top-1/2 -translate-y-1/2 end-2 p-1 rounded hover:bg-muted"
                aria-label={t("clearFilters")}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
              <X className="h-3.5 w-3.5" />
              {t("clearFilters")}
              <Badge variant="secondary" className="ms-1">{activeFilters}</Badge>
            </Button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t("sortBy")}:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{t("default")}</SelectItem>
                <SelectItem value="priority">{t("priority")}</SelectItem>
                <SelectItem value="region">{t("region")}</SelectItem>
                <SelectItem value="branch">{t("branch")}</SelectItem>
                <SelectItem value="remaining">{t("remainingVacancies")}</SelectItem>
                <SelectItem value="hired">{t("hired")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={sortBy === "default"}
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              aria-label="Toggle sort direction"
            >
              {sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!filteredJobs.length}
            onClick={() => exportJobsToXlsx(filteredJobs)}
          >
            <Download className="h-3.5 w-3.5" />
            {t("exportExcel")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-4">
          <FilterGroup label={t("status")}>
            {STATUS_OPTIONS.map((s) => (
              <Chip
                key={s}
                active={statuses.has(s)}
                onClick={() => toggle(statuses, s, setStatuses)}
              >
                {s}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label={t("priority")}>
            {PRIORITY_OPTIONS.map((p) => (
              <Chip
                key={p}
                active={priorities.has(p)}
                onClick={() => toggle(priorities, p, setPriorities)}
                tone={p === "High" ? "destructive" : "default"}
              >
                {p}
              </Chip>
            ))}
          </FilterGroup>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">
            {ar ? "الكل" : "All"}
            <span className="ms-1 text-xs opacity-70">({totals.total})</span>
          </TabsTrigger>
          {grouped.regions.map((r) => {
            const count = [...(grouped.byRegion.get(r)?.values() ?? [])].reduce(
              (a, arr) => a + arr.length, 0,
            );
            return (
              <TabsTrigger key={r} value={r} className="gap-2">
                {r}
                <span className="text-xs opacity-70">({count})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={tab} className="space-y-6 mt-6">
          {isLoading ? (
            <Card className="p-6 text-muted-foreground">{t("loading")}</Card>
          ) : !allJobs.length ? (
            <Card className="p-6 text-muted-foreground">{t("noData")}</Card>
          ) : !filteredJobs.length ? (
            <Card className="p-10 text-center text-muted-foreground space-y-3">
              <div>{t("noMatches")}</div>
              <Button variant="outline" size="sm" onClick={clearAll}>
                {t("clearFilters")}
              </Button>
            </Card>
          ) : (
            visibleRegions.map((region) => {
              const branches = grouped.byRegion.get(region)!;
              const ordered = BRANCH_ORDER.filter((b) => branches.has(b)).concat(
                [...branches.keys()].filter((b) => !BRANCH_ORDER.includes(b)),
              );
              const regionTotal = [...branches.values()].reduce((a, arr) => a + arr.length, 0);
              return (
                <Card key={region} className="glass shadow-elegant overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                    <h2 className="text-lg font-semibold">{region}</h2>
                    <Badge variant="secondary">
                      {regionTotal} {ar ? "شاغر" : "vacancies"}
                    </Badge>
                  </div>
                  <div className="divide-y divide-border">
                    {ordered.map((branch) => {
                      const list = branches.get(branch)!;
                      return (
                        <div key={branch}>
                          <div className="flex items-center gap-2 px-5 py-2 bg-background/40">
                            <BranchIcon branch={branch} />
                            <span className="font-medium">{branch}</span>
                            <span className="text-xs text-muted-foreground">
                              · {list.length} {ar ? "وظيفة" : "roles"}
                            </span>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr>
                                <th className="px-5 py-2 text-start font-normal w-32">{t("code")}</th>
                                <th className="px-4 py-2 text-start font-normal">{t("title")}</th>
                                <th className="px-4 py-2 text-start font-normal w-28">{ar ? "الأولوية" : "Priority"}</th>
                                <th className="px-4 py-2 text-start font-normal w-24">{t("headcount")}</th>
                                <th className="px-4 py-2 text-start font-normal w-24">{t("hired")}</th>
                                <th className="px-4 py-2 text-start font-normal w-24">{t("status")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((j) => (
                                <tr
                                  key={j.id}
                                  onClick={() => setSelectedJob(j)}
                                  className="border-t border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
                                >
                                  <td className="px-5 py-2 font-mono text-xs">
                                    <Highlight text={j.job_code} match={debouncedSearch} />
                                  </td>
                                  <td className="px-4 py-2">
                                    <Highlight text={j.title} match={debouncedSearch} />
                                  </td>
                                  <td className="px-4 py-2">
                                    <Badge variant={j.priority === "High" ? "destructive" : "outline"}>
                                      {j.priority}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2">{j.headcount}</td>
                                  <td className="px-4 py-2">{j.hired_count}</td>
                                  <td className="px-4 py-2">
                                    <Badge variant={j.status === "Open" ? "default" : "secondary"}>
                                      {j.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <JobDetailsDialog job={selectedJob} onClose={() => setSelectedJob(null)} ar={ar} t={t} />
    </div>
  );
}

function JobDetailsDialog({
  job, onClose, ar, t,
}: { job: Job | null; onClose: () => void; ar: boolean; t: (k: any) => string }) {
  const { data: candidates } = useQuery({
    queryKey: ["job-candidates", job?.id],
    enabled: !!job,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id,stage,status,full_name,score")
        .eq("job_id", job!.id);
      if (error) throw error;
      return data as Array<{ id: string; stage: string; status: string; full_name: string; score: number }>;
    },
  });

  const open = !!job;
  const fillPct = job && job.headcount ? Math.round((job.hired_count / job.headcount) * 100) : 0;
  const remaining = job ? Math.max(0, job.headcount - job.hired_count) : 0;
  const tone =
    fillPct >= 100 ? "var(--success)" : fillPct > 0 ? "var(--warning)" : "var(--primary)";

  const stages = useMemo(() => {
    const map = new Map<string, number>();
    (candidates ?? []).forEach((c) => map.set(c.stage, (map.get(c.stage) ?? 0) + 1));
    return [...map.entries()];
  }, [candidates]);

  const classification =
    job?.branch === "Headquarters"
      ? "Central Admin"
      : ["Riyadh", "Jeddah", "Qassim", "Eastern Province", "Madinah"].includes(job?.region ?? "")
        ? "Existing Branch"
        : "New Branch";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl glass max-h-[90vh] overflow-y-auto">
        {job && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{job.job_code}</span>
                <Badge variant={job.priority === "High" ? "destructive" : "outline"}>{job.priority}</Badge>
                <Badge variant={job.status === "Open" ? "default" : "secondary"}>{job.status}</Badge>
                <Badge variant="outline">{classification}</Badge>
              </div>
              <DialogTitle className="text-2xl">{job.title}</DialogTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap pt-1">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.region}
                </span>
                <span className="flex items-center gap-1.5">
                  <BranchIcon branch={job.branch} /> {job.branch}
                </span>
                {job.opened_at && (
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {t("openedOn")}: {new Date(job.opened_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {/* Hiring progress */}
              <div className="rounded-lg border border-border bg-background/40 p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {ar ? "تقدم التوظيف" : "Hiring Progress"}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums" style={{ color: tone }}>
                    {job.hired_count}
                  </span>
                  <span className="text-muted-foreground">
                    / {job.headcount} {ar ? "تم شغلها" : "filled"}
                  </span>
                </div>
                <Progress value={fillPct} className="h-2 mt-3" />
                <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                  <span>{fillPct}%</span>
                  <span>
                    {t("remaining")}: <strong className="text-foreground">{remaining}</strong>
                  </span>
                </div>
              </div>

              {/* Pipeline overview */}
              <div className="rounded-lg border border-border bg-background/40 p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {t("pipelineOverview")}
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums">
                  {candidates?.length ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  {ar ? "إجمالي المرشحين" : "total candidates"}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {stages.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t("noCandidatesYet")}</span>
                  ) : (
                    stages.map(([stage, count]) => (
                      <Badge key={stage} variant="secondary" className="text-xs">
                        {stage} · {count}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                {ar ? "الوصف" : "Description"}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap min-h-[80px]">
                {job.description?.trim() || (
                  <span className="text-muted-foreground italic">{t("noDescription")}</span>
                )}
              </div>
            </div>

            {/* Footer meta */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {job.target_fill_date && (
                <span>
                  {t("targetFill")}: {new Date(job.target_fill_date).toLocaleDateString()}
                </span>
              )}
              {job.created_at && (
                <span>
                  {ar ? "تم الإنشاء" : "Created"}: {new Date(job.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({
  label, value, sub, accent,
}: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 min-w-[110px] ${
        accent ? "bg-primary/10 border-primary/30" : "bg-muted/40 border-border"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">
        {value}
        {sub && <span className="ms-1 text-xs font-normal text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({
  active, onClick, children, tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "destructive";
}) {
  const activeClass =
    tone === "destructive"
      ? "bg-destructive text-destructive-foreground border-destructive"
      : "bg-primary text-primary-foreground border-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active ? activeClass : "bg-background hover:bg-muted border-border"
      }`}
    >
      {children}
    </button>
  );
}

function BranchIcon({ branch }: { branch: string }) {
  const emoji =
    branch === "Headquarters" ? "🏛️" : branch === "Girls School" ? "👩‍🏫" : branch === "Boys School" ? "👨‍🏫" : "📍";
  return <span aria-hidden>{emoji}</span>;
}

function Highlight({ text, match }: { text: string; match: string }) {
  if (!match) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(match);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-foreground rounded px-0.5">
        {text.slice(idx, idx + match.length)}
      </mark>
      {text.slice(idx + match.length)}
    </>
  );
}
