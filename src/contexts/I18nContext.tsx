import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "en" | "ar";

const translations = {
  en: {
    appName: "مشروع مدارس طويق",
    appTagline: "بوصلة التوظيف",
    dashboard: "Dashboard",
    pipeline: "Pipeline",
    calendar: "Calendar",
    candidates: "Candidates",
    jobs: "Jobs",
    aiChat: "AI Assistant",
    aiScreening: "AI Screening",
    templates: "Templates",
    auditLog: "Audit Log",
    settings: "Settings",
    signOut: "Sign Out",
    signIn: "Sign In",
    signUp: "Sign Up",
    email: "Email",
    password: "Password",
    fullName: "Full Name",
    welcome: "Welcome back",
    createAccount: "Create your account",
    continueWithGoogle: "Continue with Google",
    or: "or",
    overview: "Overview",
    totalCandidates: "Total Candidates",
    activeJobs: "Active Jobs",
    timeToHire: "Avg Time to Hire",
    offerAcceptance: "Offer Acceptance",
    funnel: "Recruitment Funnel",
    regionalProgress: "Regional Progress",
    addCandidate: "Add Candidate",
    addJob: "Post Job",
    fastTrack: "Fast Track",
    review: "Review",
    belowThreshold: "Below Threshold",
    days: "days",
    overdue: "Overdue",
    onTrack: "On Track",
    critical: "Critical",
    days_in_stage: "in stage",
    score: "Score",
    role: "Role",
    admin: "Admin",
    recruiter: "Recruiter",
    language: "Language",
    title: "Title",
    region: "Region",
    branch: "Branch",
    headcount: "Headcount",
    status: "Status",
    priority: "Priority",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    actions: "Actions",
    name: "Name",
    phone: "Phone",
    job: "Job",
    stage: "Stage",
    appliedDate: "Applied",
    uploadCV: "Upload CV",
    runScreening: "Run AI Screening",
    askAi: "Ask the AI...",
    send: "Send",
    noData: "No data yet",
    loading: "Loading...",
    open: "Open",
    filled: "Filled",
    onHold: "On Hold",
    search: "Search",
    create: "Create",
    saving: "Saving...",
    code: "Code",
    hired: "Hired",
    none: "None",
    all: "All",
    searchPlaceholder: "Search by title or job code...",
    filters: "Filters",
    clearFilters: "Clear",
    noMatches: "No jobs match your filters",
    showing: "Showing",
    of: "of",
    accessDenied: "Access denied",
    adminsOnly: "This area is restricted to administrators.",
  },
  ar: {
    appName: "مشروع مدارس طويق",
    appTagline: "بوصلة التوظيف",
    dashboard: "لوحة التحكم",
    pipeline: "خط التوظيف",
    calendar: "التقويم",
    candidates: "المرشحون",
    jobs: "الوظائف",
    aiChat: "المساعد الذكي",
    aiScreening: "الفرز الذكي",
    templates: "القوالب",
    auditLog: "سجل التدقيق",
    settings: "الإعدادات",
    signOut: "تسجيل الخروج",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    fullName: "الاسم الكامل",
    welcome: "مرحباً بعودتك",
    createAccount: "أنشئ حسابك",
    continueWithGoogle: "المتابعة عبر جوجل",
    or: "أو",
    overview: "نظرة عامة",
    totalCandidates: "إجمالي المرشحين",
    activeJobs: "الوظائف النشطة",
    timeToHire: "متوسط وقت التوظيف",
    offerAcceptance: "قبول العروض",
    funnel: "قمع التوظيف",
    regionalProgress: "التقدم الإقليمي",
    addCandidate: "إضافة مرشح",
    addJob: "نشر وظيفة",
    fastTrack: "مسار سريع",
    review: "مراجعة",
    belowThreshold: "دون الحد",
    days: "أيام",
    overdue: "متأخر",
    onTrack: "في الموعد",
    critical: "حرج",
    days_in_stage: "في المرحلة",
    score: "النتيجة",
    role: "الدور",
    admin: "مدير",
    recruiter: "موظف توظيف",
    language: "اللغة",
    title: "المسمى",
    region: "المنطقة",
    branch: "الفرع",
    headcount: "العدد المطلوب",
    status: "الحالة",
    priority: "الأولوية",
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    actions: "إجراءات",
    name: "الاسم",
    phone: "الجوال",
    job: "الوظيفة",
    stage: "المرحلة",
    appliedDate: "تاريخ التقديم",
    uploadCV: "رفع السيرة الذاتية",
    runScreening: "تشغيل الفرز الذكي",
    askAi: "اسأل المساعد الذكي...",
    send: "إرسال",
    noData: "لا توجد بيانات بعد",
    loading: "جاري التحميل...",
    open: "مفتوحة",
    filled: "مكتملة",
    onHold: "معلقة",
    search: "بحث",
    create: "إنشاء",
    saving: "جاري الحفظ...",
    code: "الرمز",
    hired: "تم التعيين",
    none: "لا شيء",
    all: "الكل",
    accessDenied: "الوصول مرفوض",
    adminsOnly: "هذه المنطقة مخصصة للمسؤولين فقط.",
  },
};

export type TKey = keyof typeof translations.en;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ar";
    return (localStorage.getItem("lang") as Lang) || "ar";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("lang", lang);
  }, [lang]);

  const value: Ctx = {
    lang,
    setLang: setLangState,
    t: (k) => (translations[lang] as Record<string, string>)[k] ?? String(k),
    dir: lang === "ar" ? "rtl" : "ltr",
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
