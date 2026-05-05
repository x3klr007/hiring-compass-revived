import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
};

// Mirrors the workbook ordering: HQ + existing branches first, new branches after
const REGION_ORDER = [
  "Riyadh",
  "Jeddah",
  "Qassim",
  "Eastern Province",
  "Madinah",
  "Hail",
  "Abha",
  "Al-Ahsa",
  "Makkah",
  "Jazan",
];
const BRANCH_ORDER = ["Headquarters", "Boys School", "Girls School"];

function JobsPage() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<string>("all");

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

  const grouped = useMemo(() => {
    const jobs = data ?? [];
    const byRegion = new Map<string, Map<string, Job[]>>();
    for (const j of jobs) {
      if (!byRegion.has(j.region)) byRegion.set(j.region, new Map());
      const br = byRegion.get(j.region)!;
      if (!br.has(j.branch)) br.set(j.branch, []);
      br.get(j.branch)!.push(j);
    }
    const regions = REGION_ORDER.filter((r) => byRegion.has(r)).concat(
      [...byRegion.keys()].filter((r) => !REGION_ORDER.includes(r)),
    );
    return { jobs, byRegion, regions };
  }, [data]);

  const totals = useMemo(() => {
    const jobs = data ?? [];
    return {
      total: jobs.length,
      open: jobs.filter((j) => j.status === "Open").length,
      regions: new Set(jobs.map((j) => j.region)).size,
      branches: new Set(jobs.map((j) => `${j.region}|${j.branch}`)).size,
    };
  }, [data]);

  const visibleRegions =
    tab === "all" ? grouped.regions : grouped.regions.filter((r) => r === tab);

  const ar = lang === "ar";

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
          <SummaryStat label={ar ? "إجمالي الشواغر" : "Total Vacancies"} value={totals.total} accent />
          <SummaryStat label={ar ? "مفتوح" : "Open"} value={totals.open} />
          <SummaryStat label={ar ? "المناطق" : "Regions"} value={totals.regions} />
          <SummaryStat label={ar ? "الفروع" : "Branches"} value={totals.branches} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">{ar ? "الكل" : "All"}</TabsTrigger>
          {grouped.regions.map((r) => {
            const count = [...(grouped.byRegion.get(r)?.values() ?? [])].reduce(
              (a, arr) => a + arr.length,
              0,
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
          ) : !data?.length ? (
            <Card className="p-6 text-muted-foreground">{t("noData")}</Card>
          ) : (
            visibleRegions.map((region) => {
              const branches = grouped.byRegion.get(region)!;
              const ordered = BRANCH_ORDER.filter((b) => branches.has(b)).concat(
                [...branches.keys()].filter((b) => !BRANCH_ORDER.includes(b)),
              );
              const regionTotal = [...branches.values()].reduce(
                (a, arr) => a + arr.length,
                0,
              );
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
                                <tr key={j.id} className="border-t border-border/60">
                                  <td className="px-5 py-2 font-mono text-xs">{j.job_code}</td>
                                  <td className="px-4 py-2">{j.title}</td>
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
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 min-w-[110px] ${
        accent ? "bg-primary/10 border-primary/30" : "bg-muted/40 border-border"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function BranchIcon({ branch }: { branch: string }) {
  const emoji =
    branch === "Headquarters" ? "🏛️" : branch === "Girls School" ? "👩‍🏫" : branch === "Boys School" ? "👨‍🏫" : "📍";
  return <span aria-hidden>{emoji}</span>;
}
