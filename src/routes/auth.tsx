import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nasheen Recruitment" },
      { name: "description", content: "Sign in to the Nasheen Recruitment ATS." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang, dir } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email to confirm your account.");
  }

  return (
    <div dir={dir} className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 end-4">
        <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "EN" : "ع"}
        </Button>
      </div>
      <div className="w-full max-w-md glass rounded-2xl shadow-elegant p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow mb-3">
            <Compass className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-gradient">{t("appName")}</h1>
          <p className="text-xs text-muted-foreground">{t("appTagline")}</p>
        </div>
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
            <TabsTrigger value="signup">{t("signUp")}</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-3">
              <div>
                <Label htmlFor="si-email">{t("email")}</Label>
                <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="si-pw">{t("password")}</Label>
                <Input id="si-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t("loading") : t("signIn")}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-3">
              <div>
                <Label htmlFor="su-name">{t("fullName")}</Label>
                <Input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="su-email">{t("email")}</Label>
                <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="su-pw">{t("password")}</Label>
                <Input id="su-pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t("loading") : t("createAccount")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
