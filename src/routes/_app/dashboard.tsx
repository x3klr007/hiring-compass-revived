import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Briefcase, Users, MapPin, Building2, TrendingUp, Sparkles } from "lucide-react";

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
  priority: string;
};

const REGION_ORDER = [
  "Riyadh", "Jeddah", "Qassim", "Eastern Province", "Madinah",
  "Hail", "Abha", "Al-Ahsa", "Makkah", "Jazan",
];

const ROLE_COLORS: Record<string, string> = {
  "Expert Trainer": "var(--primary)",
  "Stage Trainer": "var(--primary-glow)",
  "Admin Supervisor": "var(--success)",
  "Central Admin": "var(--warning)",
};

function Dashboard() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*");
      if (error) throw error;
      return data as Job[];
    },
  });

  const stats = useMemo(() => {
    const totalHeadcount = jobs.reduce((a, j) => a + (j.headcount || 0), 0);
    const totalHired = jobs.reduce((a, j) => a + (j.hired_count || 0), 0);
    const open = jobs.filter((j) => j.status === "Open").length;
    const regions = new Set(jobs.map((j) => j.region)).size;
    const branches = new Set(jobs.map((j) => `${j.region}|${j.branch}`)).size;

    const byRegion = REGION_ORDER
      .map((r) => {
        const list = jobs.filter((j) => j.region === r);
        return {
          region: r,
          total: list.reduce((a, j) => a + j.headcount, 0),
          hired: list.reduce((a, j) => a + j.hired_count, 0),
        };
      })
      .filter((r) => r.total > 0);

    const byRole = Object.entries(
      jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.title] = (acc[j.title] || 0) + j.headcount;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);

    return { totalHeadcount, totalHired, open, high, regions, branches, byRegion, byRole };
  }, [jobs]);

  const fillRate = stats.totalHeadcount
    ? Math.round((stats.totalHired / stats.totalHeadcount) * 100)
    : 0;

  const kpis = [
    {
      label: ar ? "إجمالي الشواغر" : t("activeJobs"),
      value: stats.totalHeadcount,
      icon: Briefcase,
      sub: `${stats.open} ${ar ? "مفتوح" : "open"}`,
      tone: "primary",
    },
    {
      label: ar ? "المرشحون" : t("totalCandidates"),
      value: 0,
      icon: Users,
      sub: ar ? "لا يوجد بعد" : "none yet",
      tone: "accent",
    },
    {
      label: ar ? "المناطق" : "Regions",
      value: stats.regions,
      icon: MapPin,
      sub: `${stats.branches} ${ar ? "فرعاً" : "branches"}`,
      tone: "success",
    },
    {
      label: ar ? "أولوية عالية" : "High Priority",
      value: stats.high,
      icon: Sparkles,
      sub: ar ? "فروع جديدة" : "new branches",
      tone: "warning",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">{t("dashboard")}</h1>
        <p className="text-muted-foreground">{t("overview")}</p>
      </div>

      {/* Hero Fill Rate */}
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
              <MiniStat label={ar ? "أولوية عالية" : "Urgent"} value={stats.high} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, sub, tone }) => (
          <Card key={label} className="glass shadow-elegant">
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
        ))}
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
                      title={`${title}: ${count}`}
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
                        {title}
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
