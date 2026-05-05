import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Save } from "lucide-react";
import { toast } from "sonner";

type Tmpl = {
  id: string;
  template_key: string;
  name: string;
  channel: string;
  subject_en: string | null;
  subject_ar: string | null;
  body_en: string;
  body_ar: string;
};

function TemplatesPage() {
  const { t, lang, dir } = useI18n();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Tmpl[]>([]);
  const [editing, setEditing] = useState<Record<string, Tmpl>>({});

  const load = async () => {
    const { data } = await supabase.from("message_templates").select("*").order("template_key");
    setItems((data ?? []) as Tmpl[]);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (tpl: Tmpl) => {
    const merged = { ...tpl, ...(editing[tpl.id] ?? {}) };
    const { error } = await supabase
      .from("message_templates")
      .update({
        subject_en: merged.subject_en,
        subject_ar: merged.subject_ar,
        body_en: merged.body_en,
        body_ar: merged.body_ar,
      })
      .eq("id", tpl.id);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      setEditing((e) => ({ ...e, [tpl.id]: undefined as any }));
      await load();
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <FileText className="h-7 w-7" />
          {t("templates")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {lang === "ar" ? "قوالب البريد والرسائل النصية ثنائية اللغة." : "Bilingual email & SMS templates."}
        </p>
      </div>

      <div className="grid gap-4">
        {items.map((tpl) => {
          const cur = { ...tpl, ...(editing[tpl.id] ?? {}) };
          const dirty = !!editing[tpl.id];
          return (
            <Card key={tpl.id} className="glass shadow-elegant p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{tpl.name}</div>
                  <div className="text-xs text-muted-foreground">{tpl.template_key}</div>
                </div>
                <Badge variant="secondary">{tpl.channel}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>EN subject</Label>
                  <Input
                    value={cur.subject_en ?? ""}
                    disabled={!isAdmin}
                    onChange={(e) => setEditing((s) => ({ ...s, [tpl.id]: { ...cur, subject_en: e.target.value } }))}
                  />
                  <Label>EN body</Label>
                  <Textarea
                    rows={4}
                    value={cur.body_en}
                    disabled={!isAdmin}
                    onChange={(e) => setEditing((s) => ({ ...s, [tpl.id]: { ...cur, body_en: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2" dir="rtl">
                  <Label>AR العنوان</Label>
                  <Input
                    value={cur.subject_ar ?? ""}
                    disabled={!isAdmin}
                    onChange={(e) => setEditing((s) => ({ ...s, [tpl.id]: { ...cur, subject_ar: e.target.value } }))}
                  />
                  <Label>AR النص</Label>
                  <Textarea
                    rows={4}
                    value={cur.body_ar}
                    disabled={!isAdmin}
                    onChange={(e) => setEditing((s) => ({ ...s, [tpl.id]: { ...cur, body_ar: e.target.value } }))}
                  />
                </div>
              </div>
              {isAdmin && (
                <div className="flex justify-end">
                  <Button onClick={() => save(tpl)} disabled={!dirty} size="sm">
                    <Save className="h-3.5 w-3.5 me-1" />
                    {lang === "ar" ? "حفظ" : "Save"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
        {items.length === 0 && (
          <Card className="glass shadow-elegant p-10 text-center text-muted-foreground">{t("noData")}</Card>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/templates")({
  component: TemplatesPage,
});
