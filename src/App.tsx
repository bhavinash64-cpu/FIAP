import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import FamilyLogin from "./pages/family/FamilyLogin";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRespondent } from "@/components/family/RequireRespondent";
import { AuthProvider } from "@/lib/auth";
import { useDocLang } from "@/lib/i18n";
import { usePreferenceEffects } from "@/lib/preferences";

const AuditLog = lazy(() => import("./pages/AuditLog"));
const Overview = lazy(() => import("./pages/admin/Overview"));
const SurveyList = lazy(() => import("./pages/admin/SurveyList"));
const QuestionBank = lazy(() => import("./pages/admin/QuestionBank"));
const Templates = lazy(() => import("./pages/admin/Templates"));
const QrManager = lazy(() => import("./pages/admin/QrManager"));
const Responses = lazy(() => import("./pages/admin/Responses"));
const AnalyticsHome = lazy(() => import("./pages/admin/AnalyticsHome"));
const ExportCenter = lazy(() => import("./pages/admin/ExportCenter"));
const Notifications = lazy(() => import("./pages/admin/Notifications"));
const HelpAbout = lazy(() => import("./pages/admin/HelpAbout"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const SurveyBuilder = lazy(() => import("./pages/admin/SurveyBuilder"));
const SurveyPreview = lazy(() => import("./pages/admin/SurveyPreview"));
const SurveyAnalytics = lazy(() => import("./pages/admin/SurveyAnalytics"));
const SurveyReport = lazy(() => import("./pages/admin/SurveyReport"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const FamilyCases = lazy(() => import("./pages/admin/FamilyCases"));
const DemoPreview = lazy(() => import("./pages/DemoPreview"));
// Off the family critical path — lazy so the family/rural first paint stays small.
const Auth = lazy(() => import("./pages/Auth"));
const SecureAccessNotice = lazy(() => import("./pages/family/SecureAccessNotice"));
const NotFound = lazy(() => import("./pages/NotFound"));

/**
 * The assessment itself is lazy, but the family LOGIN is not (imported above).
 * A respondent's whole session begins on that one screen, often on a slow rural
 * connection after scanning a printed QR — making them wait on a chunk fetch
 * before they can even see the PIN field is the worst possible place to spend
 * their first two seconds.
 */
const FamilyAssessment = lazy(() => import("./pages/family/FamilyAssessment"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Persistent admin layout. The sidebar (AppShell) and auth guard mount ONCE;
 * only the routed content inside the Outlet swaps.
 *
 * No AnimatePresence here on purpose: `mode="wait"` held the incoming page back
 * until the outgoing one finished its exit transition, so every tab switch paid
 * an animation before it could even start rendering. The incoming page now
 * mounts immediately and fades in via CSS.
 */
function AppLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

function AppRoutes() {
  useDocLang();
  usePreferenceEffects();
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Overview />} />
          <Route path="surveys" element={<SurveyList />} />
          <Route path="surveys/:id/edit" element={<SurveyBuilder />} />
          <Route path="surveys/:id/analytics" element={<SurveyAnalytics />} />
          {/* Question Library sits under Surveys. `masters` was an interim path
              for the same page — redirected so older bookmarks keep working. */}
          <Route path="question-bank" element={<QuestionBank />} />
          <Route path="masters" element={<Navigate to="/app/question-bank" replace />} />
          {/* Templates is no longer a sidebar destination; the route stays so
              the dashboard's "From template" quick action and any saved links
              keep working. */}
          <Route path="templates" element={<Templates />} />
          <Route path="qr" element={<QrManager />} />
          <Route path="families" element={<FamilyCases />} />
          <Route path="responses" element={<Responses />} />
          {/* Response Explorer was merged into Responses — redirected so older
              bookmarks land on the workspace that replaced it. */}
          <Route path="response-explorer" element={<Navigate to="/app/responses" replace />} />
          <Route path="analytics" element={<AnalyticsHome />} />
          <Route path="reports" element={<Reports />} />
          <Route path="export" element={<ExportCenter />} />
          {/* Notifications and the audit log are intentionally unlinked from the
              sidebar in v1; the routes and pages stay reachable by URL. */}
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpAbout />} />
        </Route>
        <Route path="/app/surveys/:id/preview" element={<RequireAuth><SurveyPreview /></RequireAuth>} />
        <Route path="/app/surveys/:id/report" element={<RequireAuth><SurveyReport /></RequireAuth>} />
        {/*
          The family entrance. Three routes and nothing else: sign in, sign in
          scoped by a QR/link token, and the assessment. A respondent has no
          dashboard, no list and no profile to navigate to — the absence of any
          other route here is the product decision, not an omission.
        */}
        <Route path="/family" element={<FamilyLogin />} />
        <Route path="/family/assessment" element={<RequireRespondent><FamilyAssessment /></RequireRespondent>} />
        <Route path="/family/:token" element={<FamilyLogin />} />

        {/*
          `/s/:slug` is RETIRED. It served a full assessment to anyone holding a
          slug, which made the family PIN decorative — a forwarded link was an
          uncredentialled way into the same instrument. Retiring it here rather
          than inside SurveyRunner keeps the page intact on disk (it is another
          lane's file) and makes this a one-line revert if the anonymous path is
          ever wanted back.
        */}
        <Route path="/s/:slug" element={<SecureAccessNotice />} />
        <Route path="/demo" element={<DemoPreview />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="theme">
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;