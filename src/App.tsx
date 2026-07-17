import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
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
import { useDocLang } from "@/lib/i18n";

// Admin-only screens are lazy-loaded so a parent opening a /s/:slug link on
// their phone never downloads the console's chart/export code.
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Overview = lazy(() => import("./pages/admin/Overview"));
const SurveyList = lazy(() => import("./pages/admin/SurveyList"));
const QuestionBank = lazy(() => import("./pages/admin/QuestionBank"));
const Responses = lazy(() => import("./pages/admin/Responses"));
const AnalyticsHome = lazy(() => import("./pages/admin/AnalyticsHome"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const SurveyBuilder = lazy(() => import("./pages/admin/SurveyBuilder"));
const SurveyPreview = lazy(() => import("./pages/admin/SurveyPreview"));
const SurveyAnalytics = lazy(() => import("./pages/admin/SurveyAnalytics"));
const SurveyReport = lazy(() => import("./pages/admin/SurveyReport"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const DemoPreview = lazy(() => import("./pages/DemoPreview"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Persistent admin layout. The sidebar (AppShell) and auth guard mount ONCE;
 * only the routed content inside the Outlet swaps — so navigating between tabs
 * refreshes just the content, never the whole page or the sidebar.
 */
function AppLayout() {
  const location = useLocation();
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<RouteFallback />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

function AppRoutes() {
  useDocLang();
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />

        {/* Admin console — persistent shell, content-only navigation */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Overview />} />
          <Route path="surveys" element={<SurveyList />} />
          <Route path="surveys/:id/edit" element={<SurveyBuilder />} />
          <Route path="surveys/:id/analytics" element={<SurveyAnalytics />} />
          <Route path="question-bank" element={<QuestionBank />} />
          <Route path="responses" element={<Responses />} />
          <Route path="analytics" element={<AnalyticsHome />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>

        {/* Full-screen admin views (no shell) */}
        <Route path="/app/surveys/:id/preview" element={<RequireAuth><SurveyPreview /></RequireAuth>} />
        <Route path="/app/surveys/:id/report" element={<RequireAuth><SurveyReport /></RequireAuth>} />

        {/* Public — no login, respondent-facing */}
        <Route path="/s/:slug" element={<SurveyRunner />} />
        <Route path="/demo" element={<DemoPreview />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </MotionConfig>
  </QueryClientProvider>
);

export default App;
