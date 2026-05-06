import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, X, Download } from "lucide-react";
import { exportJobsToXlsx } from "@/lib/exportJobsXlsx";
import { exportJobsToCsv } from "@/lib/exportJobsCsv";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { roleLabel, branchLabel } from "@/lib/labels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { MapPin, Calendar as CalendarIcon, Users, ArrowUp, ArrowDown } from "lucide-react";

type JobsSearch = {
  q?: string;
  status?: string[];
  region?: string;
};

export const Route = createFileRoute("/_app/jobs")({
  component: JobsPage,
  validateSearch: (raw: Record<string, unknown>): JobsSearch => {
    const toArr = (v: unknown): string[] | undefined => {
      if (Array.isArray(v)) return v.map(String).filter(Boolean);
      if (typeof v === "string" && v.length) return v.split(",").filter(Boolean);
      return undefined;
    };
    const q = typeof raw.q === "string" && raw.q ? raw.q : undefined;
    const region = typeof raw.region === "string" && raw.region ? raw.region : undefined;
    return {
      ...(q ? { q } : {}),
      ...(toArr(raw.status) ? { status: toArr(raw.status) } : {}),
      ...(region ? { region } : {}),
    };
  },
});

type Job = {
  id: string;
  job_code: string;
  title: string;
  region: string;
  branch: string;
  headcount: number;
  hired_count: number;
  status: string;
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

function JobsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const search_ = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const tab = search_.region ?? "all";
  const setTab = (v: string) =>
    navigate({
      search: (prev: JobsSearch) => ({ ...prev, region: v === "all" ? undefined : v }),
      replace: true,
    });

  const [search, setSearch] = useState(search_.q ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState((search_.q ?? "").toLowerCase());
  const statuses = useMemo<Set<string>>(() => new Set<string>(search_.status ?? []), [search_.status]);
  const setStatuses = (s: Set<string>) =>
    navigate({
      search: (prev: JobsSearch) => ({ ...prev, status: s.size ? [...s] : undefined }),
      replace: true,
    });

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  type SortKey = "default" | "region" | "branch" | "remaining" | "hired" | "code" | "title" | "status";
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: Exclude<SortKey, "default">) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  };

  useEffect(() => {
    const trimmed = search.trim();
    const id = setTimeout(() => {
      setDebouncedSearch(trimmed.toLowerCase());
      navigate({
        search: (prev: JobsSearch) => ({ ...prev, q: trimmed || undefined }),
        replace: true,
      });
    }, 200);
    return () => clearTimeout(id);
  }, [search, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id,job_code,title,region,branch,headcount,hired_count,status,description,opened_at,target_fill_date,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Job[];
    },
  });

  const allJobs = data ?? [];

  const filteredJobs = useMemo(() => {
    return allJobs.filter((j) => {
      if (statuses.size && !statuses.has(j.status)) return false;
      if (debouncedSearch) {
        const hay = `${j.title} ${j.job_code}`.toLowerCase();
        if (!hay.includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [allJobs, statuses, debouncedSearch]);

  const sortedJobs = useMemo(() => {
    if (sortBy === "default") return filteredJobs;
    const dir = sortDir === "asc" ? 1 : -1;
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
        case "region": return regionRank(j.region);
        case "branch": return branchRank(j.branch);
        case "remaining": return Math.max(0, j.headcount - j.hired_count);
        case "hired": return j.hired_count;
        case "code": return j.job_code;
        case "title": return j.title.toLowerCase();
        case "status": return j.status;
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
    (debouncedSearch ? 1 : 0) + statuses.size;

  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  };

  const clearAll = () => {
    setSearch("");
    setStatuses(new Set());
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!filteredJobs.length}>
                <Download className="h-3.5 w-3.5" />
                {ar ? "تصدير" : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportJobsToXlsx(filteredJobs)}>
                {ar ? "Excel (.xlsx)" : "Excel (.xlsx)"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportJobsToCsv(filteredJobs)}>
                {ar ? "CSV (.csv)" : "CSV (.csv)"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <EmptyMatches
              ar={ar}
              allJobs={allJobs}
              search={debouncedSearch}
              statuses={statuses}
              region={tab}
              onClearAll={clearAll}
              onClearSearch={() => setSearch("")}
              onClearStatuses={() => setStatuses(new Set())}
              onClearRegion={() => setTab("all")}
              onPickJob={setSelectedJob}
            />
          ) : sortBy !== "default" ? (
            (() => {
              const flat = sortedJobs.filter((j) => tab === "all" || j.region === tab);
              return (
                <Card className="glass shadow-elegant overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      {t("sortedBy")}: <span className="text-foreground font-semibold">{labelForSort(sortBy, t)}</span>{" "}
                      {sortDir === "asc" ? "↑" : "↓"}
                    </h2>
                    <Badge variant="secondary">
                      {flat.length} {ar ? "شاغر" : "vacancies"}
                    </Badge>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground bg-background/40">
                      <tr>
                        <SortableTh className="px-5 py-2 w-28" sortKey="code" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("code")}</SortableTh>
                        <SortableTh className="px-4 py-2" sortKey="title" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("title")}</SortableTh>
                        <SortableTh className="px-4 py-2 w-32" sortKey="region" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("region")}</SortableTh>
                        <SortableTh className="px-4 py-2 w-32" sortKey="branch" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("branch")}</SortableTh>
                        
                        <SortableTh className="px-4 py-2 w-20" sortKey="hired" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="end">{t("headcount")}</SortableTh>
                        <SortableTh className="px-4 py-2 w-20" sortKey="hired" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="end">{t("hired")}</SortableTh>
                        <SortableTh className="px-4 py-2 w-24" sortKey="remaining" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="end">{t("remaining")}</SortableTh>
                        <SortableTh className="px-4 py-2 w-24" sortKey="status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("status")}</SortableTh>
                      </tr>
                    </thead>
                    <tbody>
                      {flat.map((j) => {
                        const remaining = Math.max(0, j.headcount - j.hired_count);
                        return (
                          <tr
                            key={j.id}
                            onClick={() => setSelectedJob(j)}
                            className="border-t border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
                          >
                            <td className="px-5 py-2 font-mono text-xs">
                              <Highlight text={j.job_code} match={debouncedSearch} />
                            </td>
                            <td className="px-4 py-2">
                              <Highlight text={roleLabel(j.title, lang)} match={debouncedSearch} />
                            </td>
                            <td className="px-4 py-2">{j.region}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                <BranchIcon branch={j.branch} /> {branchLabel(j.branch, lang)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-end tabular-nums">{j.headcount}</td>
                            <td className="px-4 py-2 text-end tabular-nums">{j.hired_count}</td>
                            <td className="px-4 py-2 text-end tabular-nums font-medium">{remaining}</td>
                            <td className="px-4 py-2">
                              <Badge variant={j.status === "Open" ? "default" : "secondary"}>
                                {j.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              );
            })()
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
                            <span className="font-medium">{branchLabel(branch, lang)}</span>
                            <span className="text-xs text-muted-foreground">
                              · {list.length} {ar ? "وظيفة" : "roles"}
                            </span>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr>
                                <SortableTh className="px-5 py-2 w-32" sortKey="code" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("code")}</SortableTh>
                                <SortableTh className="px-4 py-2" sortKey="title" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("title")}</SortableTh>
                                
                                <SortableTh className="px-4 py-2 w-24" sortKey="hired" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("headcount")}</SortableTh>
                                <SortableTh className="px-4 py-2 w-24" sortKey="hired" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("hired")}</SortableTh>
                                <SortableTh className="px-4 py-2 w-24" sortKey="status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>{t("status")}</SortableTh>
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
                                    <Highlight text={roleLabel(j.title, lang)} match={debouncedSearch} />
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
  const lang: "ar" | "en" = ar ? "ar" : "en";
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
                <Badge variant={job.status === "Open" ? "default" : "secondary"}>{job.status}</Badge>
                <Badge variant="outline">{classification}</Badge>
              </div>
              <DialogTitle className="text-2xl">{roleLabel(job.title, lang)}</DialogTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap pt-1">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.region}
                </span>
                <span className="flex items-center gap-1.5">
                  <BranchIcon branch={job.branch} /> {branchLabel(job.branch, lang)}
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

function labelForSort(sortBy: string, t: (k: any) => string) {
  switch (sortBy) {
    
    case "region": return t("region");
    case "branch": return t("branch");
    case "remaining": return t("remainingVacancies");
    case "hired": return t("hired");
    case "code": return t("code");
    case "title": return t("title");
    case "status": return t("status");
    default: return t("default");
  }
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

function SortableTh({
  children,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  className = "",
  align = "start",
}: {
  children: React.ReactNode;
  sortKey: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (k: any) => void;
  className?: string;
  align?: "start" | "end";
}) {
  const active = sortBy === sortKey;
  return (
    <th className={`text-${align} font-normal ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
          active ? "text-foreground font-medium" : ""
        } ${align === "end" ? "ms-auto" : ""}`}
      >
        {children}
        <span className="text-[10px] opacity-70 w-2 inline-block">
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function EmptyMatches({
  ar, allJobs, search, statuses, region,
  onClearAll, onClearSearch, onClearStatuses, onClearRegion, onPickJob,
}: {
  ar: boolean;
  allJobs: Job[];
  search: string;
  statuses: Set<string>;
  region: string;
  onClearAll: () => void;
  onClearSearch: () => void;
  onClearStatuses: () => void;
  onClearRegion: () => void;
  onPickJob: (j: Job) => void;
}) {
  const active: { label: string; value: string; clear: () => void }[] = [];
  if (search) active.push({ label: ar ? "بحث" : "Search", value: `"${search}"`, clear: onClearSearch });
  if (statuses.size) active.push({ label: ar ? "الحالة" : "Status", value: [...statuses].join(", "), clear: onClearStatuses });
  if (region !== "all") active.push({ label: ar ? "المنطقة" : "Region", value: region, clear: onClearRegion });

  // Build alternative suggestions by relaxing one filter at a time
  const matchExceptSearch = (j: Job) =>
    (!statuses.size || statuses.has(j.status)) &&
    (region === "all" || j.region === region);

  const suggestions: { label: string; jobs: Job[]; apply: () => void }[] = [];

  if (search) {
    const drop = allJobs.filter(matchExceptSearch).slice(0, 5);
    if (drop.length) suggestions.push({
      label: ar ? `إزالة البحث "${search}"` : `Drop search "${search}"`,
      jobs: drop, apply: onClearSearch,
    });
  }
  if (region !== "all") {
    const drop = allJobs.filter((j) =>
      (!statuses.size || statuses.has(j.status)) &&
      (!search || `${j.title} ${j.job_code}`.toLowerCase().includes(search))
    ).slice(0, 5);
    if (drop.length) suggestions.push({
      label: ar ? `جميع المناطق` : `All regions`,
      jobs: drop, apply: onClearRegion,
    });
  }
  if (statuses.size) {
    const drop = allJobs.filter((j) =>
      (region === "all" || j.region === region) &&
      (!search || `${j.title} ${j.job_code}`.toLowerCase().includes(search))
    ).slice(0, 5);
    if (drop.length) suggestions.push({
      label: ar ? "تجاهل فلتر الحالة" : "Ignore status filter",
      jobs: drop, apply: onClearStatuses,
    });
  }

  // Fuzzy title suggestions when search is active
  let fuzzy: Job[] = [];
  if (search && search.length >= 2) {
    const q = search;
    fuzzy = allJobs
      .map((j) => {
        const hay = `${j.title} ${j.job_code}`.toLowerCase();
        let score = 0;
        if (hay.includes(q)) score = 100;
        else {
          // token overlap
          const tokens = q.split(/\s+/).filter(Boolean);
          score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        }
        return { j, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.j);
  }

  return (
    <Card className="glass shadow-elegant p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="text-lg font-semibold">
          {ar ? "لا توجد وظائف مطابقة" : "No matching jobs"}
        </div>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "لم نعثر على نتائج تطابق الفلاتر الحالية. جرّب تعديلها أو استخدم أحد الاقتراحات أدناه."
            : "No results match the current filters. Try adjusting them or use one of the suggestions below."}
        </p>
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {ar ? "الفلاتر النشطة" : "Active filters"}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {active.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1.5 py-1 px-2">
                <span className="text-muted-foreground">{f.label}:</span>
                <span className="font-medium">{f.value}</span>
                <button
                  onClick={f.clear}
                  className="ms-1 rounded hover:bg-background/50 p-0.5"
                  aria-label="remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 px-2 text-xs">
              {ar ? "إزالة الكل" : "Clear all"}
            </Button>
          </div>
        </div>
      )}

      {fuzzy.length > 0 && (
        <SuggestionBlock
          title={ar ? "هل تقصد؟" : "Did you mean?"}
          jobs={fuzzy}
          ar={ar}
          onPickJob={onPickJob}
        />
      )}

      {suggestions.map((s, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {ar ? "اقتراح" : "Suggestion"}
            </div>
            <Button variant="link" size="sm" onClick={s.apply} className="h-6 p-0 text-xs">
              {s.label} →
            </Button>
          </div>
          <SuggestionList jobs={s.jobs} onPickJob={onPickJob} />
        </div>
      ))}

      {!suggestions.length && !fuzzy.length && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={onClearAll}>
            {ar ? "إزالة جميع الفلاتر" : "Clear all filters"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function SuggestionBlock({
  title, jobs, ar, onPickJob,
}: { title: string; jobs: Job[]; ar: boolean; onPickJob: (j: Job) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <SuggestionList jobs={jobs} onPickJob={onPickJob} />
    </div>
  );
}

function SuggestionList({ jobs, onPickJob }: { jobs: Job[]; onPickJob: (j: Job) => void }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
      {jobs.map((j) => (
        <li key={j.id}>
          <button
            onClick={() => onPickJob(j)}
            className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/40 text-start"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{j.job_code}</span>
              <span className="truncate">{j.title}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">{j.region}</Badge>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
