import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings as Cog, UserCog, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Profile = { id: string; full_name: string | null; email: string | null; preferred_language: string };
type RoleRow = { id: string; user_id: string; role: string };

const ROLES = ["admin", "recruiter", "hiring_manager", "interviewer"] as const;

function SettingsPage() {
  const { t, lang, dir, setLang } = useI18n();
  const { user, isAdmin } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<string>("recruiter");

  const load = async () => {
    if (!user) return;
    const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(me as Profile);
    if (isAdmin) {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      setAllProfiles((ps ?? []) as Profile[]);
      setRoles((rs ?? []) as RoleRow[]);
    }
  };
  useEffect(() => {
    load();
  }, [user, isAdmin]);

  const saveProfile = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profile.full_name, preferred_language: profile.preferred_language as any })
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else {
      setLang(profile.preferred_language as "ar" | "en");
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
    }
  };

  const addRole = async () => {
    if (!newUserId) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: newUserId, role: newRole as any });
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "ar" ? "تمت إضافة الدور" : "Role added");
      setNewUserId("");
      load();
    }
  };

  const removeRole = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <Cog className="h-7 w-7" />
          {t("settings")}
        </h1>
      </div>

      {profile && (
        <Card className="glass shadow-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold">
            <UserCog className="h-4 w-4" />
            {lang === "ar" ? "ملفي الشخصي" : "My profile"}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("fullName")}</Label>
              <Input
                value={profile.full_name ?? ""}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input value={profile.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>{lang === "ar" ? "اللغة المفضلة" : "Preferred language"}</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profile.preferred_language}
                onChange={(e) => setProfile({ ...profile, preferred_language: e.target.value })}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <Button onClick={saveProfile}>{lang === "ar" ? "حفظ" : "Save"}</Button>
        </Card>
      )}

      {isAdmin && (
        <Card className="glass shadow-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold">
            <Shield className="h-4 w-4" />
            {lang === "ar" ? "المستخدمون والصلاحيات" : "Users & roles"}
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="text-sm font-medium">{lang === "ar" ? "إضافة دور" : "Add role"}</div>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[260px]"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
              >
                <option value="">{lang === "ar" ? "— اختر مستخدم —" : "— pick user —"}</option>
                {allProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Button onClick={addRole} disabled={!newUserId}>
                {lang === "ar" ? "إضافة" : "Add"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {allProfiles.map((p) => {
              const myRoles = roles.filter((r) => r.user_id === p.id);
              return (
                <div key={p.id} className="rounded-lg border bg-card/50 p-3 flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{p.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {myRoles.length === 0 && (
                      <span className="text-xs text-muted-foreground">{lang === "ar" ? "بدون أدوار" : "no roles"}</span>
                    )}
                    {myRoles.map((r) => (
                      <Badge key={r.id} variant="secondary" className="gap-1">
                        {r.role}
                        <button
                          onClick={() => removeRole(r.id)}
                          className="hover:text-destructive ms-1"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});
