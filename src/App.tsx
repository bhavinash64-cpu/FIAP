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
import Auth from "./pages/Auth";
import SurveyRunner from "./pages/public/SurveyRunner";
import NotFound from "./pages/NotFound";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
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
const DemoPreview = lazy(() => import("./pages/DemoPreview"));

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
          <Route path="templates" element={<Templates />} />
          <Route path="qr" element={<QrManager />} />
          <Route path="responses" element={<Responses />} />
          <Route path="analytics" element={<AnalyticsHome />} />
          <Route path="reports" element={<Reports />} />
          <Route path="export" element={<ExportCenter />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="help" element={<HelpAbout />} />
        </Route>
        <Route path="/app/surveys/:id/preview" element={<RequireAuth><SurveyPreview /></RequireAuth>} />
        <Route path="/app/surveys/:id/report" element={<RequireAuth><SurveyReport /></RequireAuth>} />
        <Route path="/s/:slug" element={<SurveyRunner />} />
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