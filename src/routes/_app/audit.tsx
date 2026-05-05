import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, ShieldAlert } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
};

function AuditPage() {
  const { t, lang, dir } = useI18n();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card className="glass shadow-elegant p-10 text-center" dir={dir}>
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <div className="font-semibold">{lang === "ar" ? "مخصص للمشرفين" : "Admins only"}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {lang === "ar" ? "هذه الصفحة متاحة لمشرفي النظام فقط." : "This page is only visible to admins."}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <ScrollText className="h-7 w-7" />
          {t("auditLog")}
        </h1>
      </div>
      <Card className="glass shadow-elegant p-4">
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">{t("noData")}</div>}
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  <Badge variant="secondary" className="me-2">
                    {r.action}
                  </Badge>
                  {r.entity_type ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {r.actor_email ?? "system"} · entity {r.entity_id ?? "—"}
              </div>
              {r.details && (
                <pre className="mt-2 text-xs bg-muted/50 rounded p-2 overflow-x-auto">
                  {JSON.stringify(r.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});
