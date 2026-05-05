import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const kpis = [
    { key: "activeJobs", value: "—", icon: Briefcase },
    { key: "totalCandidates", value: "—", icon: Users },
    { key: "timeToHire", value: "—", icon: Clock },
    { key: "offerAcceptance", value: "—", icon: CheckCircle2 },
  ] as const;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">{t("dashboard")}</h1>
        <p className="text-muted-foreground">{t("overview")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ key, value, icon: Icon }) => (
          <Card key={key} className="glass shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t(key)}</CardTitle>
              <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="glass shadow-elegant">
        <CardHeader>
          <CardTitle>{t("funnel")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t("noData")}</CardContent>
      </Card>
    </div>
  );
}
