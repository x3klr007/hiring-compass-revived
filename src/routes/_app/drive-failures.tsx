import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  listDriveFailures,
  clearDriveFailures,
  type DriveFailureLog,
} from "@/server/cv-ingest.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, RefreshCw, Trash2, AlertCircle, Lightbulb } from "lucide-react";
import { toast } from "sonner";

function DriveFailuresPage() {
  const { lang, dir } = useI18n();
  const { isAdmin } = useAuth();
  const list = useAuthedServerFn(listDriveFailures);
  const clear = useAuthedServerFn(clearDriveFailures);
  const [rows, setRows] = useState<DriveFailureLog[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await list();
      setRows(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card className="glass shadow-elegant p-10 text-center" dir={dir}>
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <div className="font-semibold">{lang === "ar" ? "مخصص للمشرفين" : "Admins only"}</div>
      </Card>
    );
  }

  const onClear = async () => {
    if (!confirm(lang === "ar" ? "حذف كل السجلات؟" : "Clear all logs?")) return;
    try {
      await clear({ data: undefined });
      toast.success(lang === "ar" ? "تم المسح" : "Cleared");
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {lang === "ar" ? "سجلات فشل Google Drive" : "Drive Failure Logs"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar"
              ? "آخر 50 محاولة فاشلة لجلب ملفات/مجلدات من Google Drive مع اقتراحات الحلول."
              : "Last 50 failed attempts to fetch files/folders from Google Drive with suggested fixes."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button variant="destructive" size="sm" onClick={onClear} disabled={!rows.length}>
            <Trash2 className="h-4 w-4 me-2" />
            {lang === "ar" ? "مسح الكل" : "Clear"}
          </Button>
        </div>
      </div>

      {!rows.length ? (
        <Card className="glass p-10 text-center text-muted-foreground">
          {loading
            ? lang === "ar"
              ? "جارٍ التحميل..."
              : "Loading..."
            : lang === "ar"
            ? "لا توجد سجلات فشل ✨"
            : "No failure logs ✨"}
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="glass p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <Badge variant="destructive">status {r.status ?? "—"}</Badge>
                  {r.total_ms != null && (
                    <Badge variant="secondary">{r.total_ms}ms</Badge>
                  )}
                  {r.req_id && (
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {r.req_id}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString(lang === "ar" ? "ar" : "en")}
                </span>
              </div>

              {r.folder_id && (
                <div className="text-xs">
                  <span className="text-muted-foreground">folderId: </span>
                  <span className="font-mono break-all">{r.folder_id}</span>
                </div>
              )}
              {r.url && (
                <div className="text-xs break-all">
                  <span className="text-muted-foreground">URL: </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {r.url}
                  </a>
                </div>
              )}
              {r.reason && (
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "السبب: " : "Reason: "}
                  </span>
                  <span className="break-words">{r.reason}</span>
                </div>
              )}
              {r.suggestion && (
                <div className="flex items-start gap-2 text-sm bg-muted/40 rounded p-2 mt-1">
                  <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <span>{r.suggestion}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/drive-failures")({
  component: DriveFailuresPage,
});
