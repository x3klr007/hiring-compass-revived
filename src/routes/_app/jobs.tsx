import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/jobs")({ component: JobsPage });

function JobsPage() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">{t("jobs")}</h1>
        <p className="text-muted-foreground">{lang === "ar" ? "الطلبات الوظيفية المفتوحة" : "Open requisitions"}</p>
      </div>
      <Card className="glass shadow-elegant overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-start">
              <th className="px-4 py-3 text-start">{t("code")}</th>
              <th className="px-4 py-3 text-start">{t("title")}</th>
              <th className="px-4 py-3 text-start">{t("region")}</th>
              <th className="px-4 py-3 text-start">{t("branch")}</th>
              <th className="px-4 py-3 text-start">{t("headcount")}</th>
              <th className="px-4 py-3 text-start">{t("hired")}</th>
              <th className="px-4 py-3 text-start">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-muted-foreground" colSpan={7}>{t("loading")}</td></tr>
            ) : !data?.length ? (
              <tr><td className="px-4 py-6 text-muted-foreground" colSpan={7}>{t("noData")}</td></tr>
            ) : (
              data.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{j.job_code}</td>
                  <td className="px-4 py-3 font-medium">{j.title}</td>
                  <td className="px-4 py-3">{j.region}</td>
                  <td className="px-4 py-3">{j.branch}</td>
                  <td className="px-4 py-3">{j.headcount}</td>
                  <td className="px-4 py-3">{j.hired_count}</td>
                  <td className="px-4 py-3">{j.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
