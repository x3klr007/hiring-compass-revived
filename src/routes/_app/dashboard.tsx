import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { roleLabel, branchLabel } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, MapPin, Building2, TrendingUp, X, Download, Settings2, CheckCircle2, Clock, Target, UserCheck } from "lucide-react";
import { exportDashboardPdf } from "@/lib/exportDashboardPdf";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";


export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type Job = {
  id: string;
  title: string;
  region: string;
  branch: string;
  headcount: number;
  hired_count: number;
  status: string;
  
};

const REGION_ORDER = [
  "Riyadh", "Jeddah", "Qassim", "Eastern Province", "Madinah",
  "Hail", "Abha", "Al-Ahsa", "Makkah", "Jazan",
];

const ROLE_COLORS: Record<string, string> = {
  "Expert Trainer": "var(--primary)",
  "Trainer": "var(--primary-glow)",
  "Admin Supervisor": "var(--success)",
  "Head Office": "var(--warning)",
};

function Dashboard() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("id,title,region,branch,headcount,hired_count,status");
      if (error) throw error;
      return data as Job[];
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("id,stage,job_id");
      if (error) throw error;
      return data as { id: string; stage: string; job_id: string | null }[];
    },
  });

  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const availableRegions = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.region))).filter(Boolean).sort(),
    [jobs],
  );
  const availableBranches = useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .filter((j) => regionFilter === "all" || j.region === regionFilter)
            .map((j) => j.branch),
        ),
      )
        .filter(Boolean)
        .sort(),
    [jobs, regionFilter],
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (regionFilter === "all" || j.region === regionFilter) &&
          (branchFilter === "all" || j.branch === branchFilter),
      ),
    [jobs, regionFilter, branchFilter],
  );

  const stats = useMemo(() => {
    const filteredJobIds = new Set(filteredJobs.map((j) => j.id));
    const scopedCandidates = candidates.filter(
      (c) => !c.job_id || filteredJobIds.has(c.job_id),
    );
    const hiredCandidates = scopedCandidates.filter((c) => c.stage === "Hired");
    const interviewCandidates = scopedCandidates.filter(
      (c) => c.stage === "Interview" || c.stage === "Interviewing",
    );

    const totalHeadcount = filteredJobs.reduce((a, j) => a + (j.headcount || 0), 0);
    const totalHired = hiredCandidates.length;
    const open = filteredJobs.filter((j) => j.status === "Open").length;
    const regions = new Set(filteredJobs.map((j) => j.region)).size;
    const branches = new Set(filteredJobs.map((j) => `${j.region}|${j.branch}`)).size;

    const hiredByJob = new Map<string, number>();
    for (const c of hiredCandidates) {
      if (!c.job_id) continue;
      hiredByJob.set(c.job_id, (hiredByJob.get(c.job_id) || 0) + 1);
    }

    const byRegion = REGION_ORDER
      .map((r) => {
        const list = filteredJobs.filter((j) => j.region === r);
        return {
          region: r,
          total: list.reduce((a, j) => a + j.headcount, 0),
          hired: list.reduce((a, j) => a + (hiredByJob.get(j.id) || 0), 0),
        };
      })
      .filter((r) => r.total > 0);

    const byRole = Object.entries(
      filteredJobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.title] = (acc[j.title] || 0) + j.headcount;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);

    return {
      totalHeadcount,
      totalHired,
      open,
      regions,
      branches,
      byRegion,
      byRole,
      totalCandidates: scopedCandidates.length,
      interview: interviewCandidates.length,
    };
  }, [filteredJobs, candidates]);

  const hasFilters = regionFilter !== "all" || branchFilter !== "all";

  const fillRate = stats.totalHeadcount
    ? Math.round((stats.totalHired / stats.totalHeadcount) * 100)
    : 0;

  type KpiLink = { to: "/jobs"; search?: { status?: string[] } } | { to: "/candidates"; search?: { stage?: string } };
  const ALL_KPIS = useMemo(
    () => [
      {
        id: "headcount",
        label: ar ? "إجمالي الشواغر" : t("activeJobs"),
        value: stats.totalHeadcount,
        icon: Briefcase,
        sub: `${stats.open} ${ar ? "مفتوح" : "open"}`,
        tone: "primary",
        link: { to: "/jobs" } as KpiLink,
      },
      {
        id: "candidates",
        label: ar ? "المرشحون" : t("totalCandidates"),
        value: stats.totalCandidates,
        icon: Users,
        sub: `${stats.interview} ${ar ? "قيد المقابلة" : "in interview"}`,
        tone: "accent",
        link: { to: "/candidates" } as KpiLink,
      },
      {
        id: "regions",
        label: ar ? "المناطق" : "Regions",
        value: stats.regions,
        icon: MapPin,
        sub: `${stats.branches} ${ar ? "فرعاً" : "branches"}`,
        tone: "success",
      },
      {
        id: "open",
        label: ar ? "وظائف مفتوحة" : "Open Jobs",
        value: stats.open,
        icon: Clock,
        sub: ar ? "قيد التوظيف" : "in progress",
        tone: "warning",
        link: { to: "/jobs", search: { status: ["Open"] } } as KpiLink,
      },
      {
        id: "interview",
        label: ar ? "قيد المقابلة" : "In Interview",
        value: stats.interview,
        icon: UserCheck,
        sub: ar ? "مرشحون" : "candidates",
        tone: "warning",
        link: { to: "/candidates", search: { stage: "Interview" } } as KpiLink,
      },
      {
        id: "hired",
        label: ar ? "تم التوظيف" : "Hired",
        value: stats.totalHired,
        icon: CheckCircle2,
        sub: `${Math.max(0, stats.totalHeadcount - stats.totalHired)} ${ar ? "متبقي" : "remaining"}`,
        tone: "success",
        link: { to: "/candidates", search: { stage: "Hired" } } as KpiLink,
      },
      {
        id: "branches",
        label: ar ? "الفروع" : "Branches",
        value: stats.branches,
        icon: Building2,
        sub: `${stats.regions} ${ar ? "منطقة" : "regions"}`,
        tone: "primary",
      },
      {
        id: "fillRate",
        label: ar ? "معدل الملء" : "Fill Rate",
        value: `${stats.totalHeadcount ? Math.round((stats.totalHired / stats.totalHeadcount) * 100) : 0}%`,
        icon: Target,
        sub: `${stats.totalHired}/${stats.totalHeadcount}`,
        tone: "accent",
      },
    ],
    [ar, t, stats],
  );

  const STORAGE_KEY = "dashboard-kpi-selection";
  const DEFAULT_IDS = ["headcount", "candidates", "regions"];
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>(DEFAULT_IDS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setSelectedKpiIds(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleKpi = (id: string) => {
    setSelectedKpiIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const kpis = ALL_KPIS.filter((k) => selectedKpiIds.includes(k.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{t("dashboard")}</h1>
          <p className="text-muted-foreground">{t("overview")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={regionFilter}
            onValueChange={(v) => {
              setRegionFilter(v);
              setBranchFilter("all");
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={ar ? "المنطقة" : "Region"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل المناطق" : "All regions"}</SelectItem>
              {availableRegions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={ar ? "الفرع" : "Branch"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الفروع" : "All branches"}</SelectItem>
              {availableBranches.map((b) => (
                <SelectItem key={b} value={b}>{branchLabel(b, lang)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRegionFilter("all");
                setBranchFilter("all");
              }}
            >
              <X className="h-4 w-4 mr-1" />
              {ar ? "مسح" : "Clear"}
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-1" />
                {ar ? "تخصيص" : "Customize"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="text-sm font-medium mb-2">
                {ar ? "اختر البطاقات" : "Visible KPI cards"}
              </div>
              <div className="space-y-2">
                {ALL_KPIS.map((k) => (
                  <label
                    key={k.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                  >
                    <Checkbox
                      checked={selectedKpiIds.includes(k.id)}
                      onCheckedChange={() => toggleKpi(k.id)}
                    />
                    <k.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{k.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            onClick={() =>
              exportDashboardPdf({
                generatedAt: new Date(),
                filters: {
                  region: regionFilter === "all" ? (ar ? "كل المناطق" : "All") : regionFilter,
                  branch: branchFilter === "all" ? (ar ? "كل الفروع" : "All") : branchFilter,
                },
                fillRate,
                kpis: kpis.map((k) => ({ label: k.label, value: k.value, sub: k.sub })),
                byRegion: stats.byRegion,
                byRole: stats.byRole,
                totals: {
                  headcount: stats.totalHeadcount,
                  hired: stats.totalHired,
                  open: stats.open,
                },
              })
            }
          >
            <Download className="h-4 w-4 mr-1" />
            {ar ? "تصدير PDF" : "Export PDF"}
          </Button>
        </div>
      </div>
      <Card className="glass shadow-elegant overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, transparent 60%)" }}
        />
        <CardContent className="p-6 relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {ar ? "معدل ملء الشواغر" : "Vacancy Fill Rate"}
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-6xl font-bold text-gradient leading-none">{fillRate}%</span>
                <span className="text-muted-foreground text-sm">
                  {stats.totalHired} / {stats.totalHeadcount} {ar ? "تم شغلها" : "filled"}
                </span>
              </div>
              <div className="mt-4 max-w-md">
                <Progress value={fillRate} className="h-3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 min-w-[260px]">
              <MiniStat label={ar ? "مفتوح" : "Open"} value={stats.open} />
              <MiniStat label={ar ? "تم التوظيف" : "Hired"} value={stats.totalHired} />
              <MiniStat label={ar ? "المتبقي" : "Remaining"} value={stats.totalHeadcount - stats.totalHired} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, sub, tone, link }) => {
          const inner = (
            <Card className={`glass shadow-elegant h-full ${link ? "cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in oklab, var(--${tone}) 20%, transparent)` }}
                >
                  <Icon className="h-4 w-4" style={{ color: `var(--${tone})` }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{sub}</div>
              </CardContent>
            </Card>
          );
          return link ? (
            <Link
              key={label}
              to={link.to}
              search={link.search as never}
              className="block"
            >
              {inner}
            </Link>
          ) : (
            <div key={label}>{inner}</div>
          );
        })}
      </div>

      {/* Two columns: Regional + Role distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass shadow-elegant lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {ar ? "التوزيع الإقليمي" : "Regional Distribution"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">{t("loading")}</div>
            ) : (
              <div className="space-y-3">
                {stats.byRegion.map((r) => {
                  const max = Math.max(...stats.byRegion.map((x) => x.total));
                  const pct = (r.total / max) * 100;
                  const fillPct = r.total ? (r.hired / r.total) * 100 : 0;
                  return (
                    <div key={r.region}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{r.region}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {r.hired} / {r.total}
                        </span>
                      </div>
                      <div className="relative h-6 rounded-md overflow-hidden bg-muted/40">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md transition-all"
                          style={{
                            width: `${pct}%`,
                            background:
                              "linear-gradient(90deg, color-mix(in oklab, var(--primary) 25%, transparent), color-mix(in oklab, var(--primary-glow) 35%, transparent))",
                          }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-md transition-all"
                          style={{
                            width: `${(pct * fillPct) / 100}%`,
                            background:
                              "linear-gradient(90deg, var(--primary), var(--primary-glow))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {ar ? "حسب الدور" : "By Role"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">{t("loading")}</div>
            ) : (
              <div className="space-y-4">
                {/* donut-ish stacked bar */}
                <div className="flex h-3 w-full overflow-hidden rounded-full">
                  {stats.byRole.map(([title, count]) => (
                    <div
                      key={title}
                      style={{
                        width: `${(count / stats.totalHeadcount) * 100}%`,
                        background: ROLE_COLORS[title] ?? "var(--muted-foreground)",
                      }}
                      title={`${roleLabel(title, lang)}: ${count}`}
                    />
                  ))}
                </div>
                <ul className="space-y-2">
                  {stats.byRole.map(([title, count]) => (
                    <li key={title} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: ROLE_COLORS[title] ?? "var(--muted-foreground)" }}
                        />
                        {roleLabel(title, lang)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {count}
                        <span className="ml-1 text-xs">
                          ({Math.round((count / stats.totalHeadcount) * 100)}%)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
