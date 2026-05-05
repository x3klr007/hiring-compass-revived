import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/contexts/I18nContext";
import { Card } from "@/components/ui/card";

function makeStub(titleKey: "candidates" | "pipeline" | "calendar" | "aiScreening" | "aiChat" | "templates" | "auditLog" | "settings") {
  return function Stub() {
    const { t, lang } = useI18n();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{t(titleKey)}</h1>
          <p className="text-muted-foreground">
            {lang === "ar" ? "قيد التطوير — سيتم تفعيل هذه الوحدة في المرحلة التالية." : "Coming soon — this module will be enabled in the next phase."}
          </p>
        </div>
        <Card className="glass shadow-elegant p-10 text-center text-muted-foreground">
          {t("noData")}
        </Card>
      </div>
    );
  };
}

export const Candidates = makeStub("candidates");
export const Pipeline = makeStub("pipeline");
export const Calendar = makeStub("calendar");
export const Screening = makeStub("aiScreening");
export const Assistant = makeStub("aiChat");
export const Templates = makeStub("templates");
export const Audit = makeStub("auditLog");
export const Settings = makeStub("settings");

// Placeholder route export so this file is a valid route module if ever imported.
export const Route = createFileRoute("/_app/_stub")({ component: () => null });
