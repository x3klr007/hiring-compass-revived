import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Kanban,
  Calendar,
  Sparkles,
  Bot,
  Mail,
  ScrollText,
  Settings,
  LogOut,
  Languages,
  Compass,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n, type TKey } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { to: string; key: TKey; icon: React.ComponentType<{ className?: string }>; admin?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/jobs", key: "jobs", icon: Briefcase },
  { to: "/candidates", key: "candidates", icon: Users },
  { to: "/pipeline", key: "pipeline", icon: Kanban },
  { to: "/calendar", key: "calendar", icon: Calendar },
  { to: "/screening", key: "aiScreening", icon: Sparkles },
  { to: "/ai-chat", key: "aiChat", icon: Bot },
  { to: "/templates", key: "templates", icon: Mail, admin: true },
  { to: "/audit", key: "auditLog", icon: ScrollText, admin: true },
  { to: "/drive-failures", key: "driveFailures", icon: AlertCircle, admin: true },
  { to: "/settings", key: "settings", icon: Settings, admin: true },
];

export function AppShell() {
  const { t, lang, setLang, dir } = useI18n();
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = NAV.filter((n) => !n.admin || isAdmin);

  return (
    <div className="flex min-h-screen" dir={dir}>
      <aside
        className={cn(
          "w-64 shrink-0 glass border-0",
          dir === "rtl" ? "border-l" : "border-r"
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow">
            <Compass className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-gradient">{t("appName")}</div>
            <div className="text-[10px] text-muted-foreground">{t("appTagline")}</div>
          </div>
        </div>
        <nav className="px-2 py-3 space-y-0.5">
          {items.map(({ to, key, icon: Icon }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t(key)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 glass border-0 border-b flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground truncate">
            {user?.email}
            {isAdmin && (
              <span className="ms-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {t("admin")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            >
              <Languages className="h-4 w-4 me-1.5" />
              {lang === "ar" ? "EN" : "ع"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="h-4 w-4 me-1.5" />
              {t("signOut")}
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
