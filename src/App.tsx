import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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

// Admin-only screens are lazy-loaded: a parent opening a /s/:slug link on
// their phone should never download chart/drag-and-drop/export code that
// only the super admin console uses.
const AuditLog = lazy(() => import("./pages/AuditLog"));
const SurveyList = lazy(() => import("./pages/admin/SurveyList"));
const SurveyBuilder = lazy(() => import("./pages/admin/SurveyBuilder"));
const SurveyPreview = lazy(() => import("./pages/admin/SurveyPreview"));
const SurveyAnalytics = lazy(() => import("./pages/admin/SurveyAnalytics"));
const SurveyReport = lazy(() => import("./pages/admin/SurveyReport"));
const Reports = lazy(() => import("./pages/admin/Reports"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-dvh grid place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28 }}
      >
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location}>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            {/* Admin console — single super admin */}
            <Route path="/app" element={<RequireAuth><AppShell><SurveyList /></AppShell></RequireAuth>} />
            <Route path="/app/surveys" element={<RequireAuth><AppShell><SurveyList /></AppShell></RequireAuth>} />
            <Route path="/app/surveys/:id/edit" element={<RequireAuth><AppShell><SurveyBuilder /></AppShell></RequireAuth>} />
            <Route path="/app/surveys/:id/preview" element={<RequireAuth><SurveyPreview /></RequireAuth>} />
            <Route path="/app/surveys/:id/analytics" element={<RequireAuth><AppShell><SurveyAnalytics /></AppShell></RequireAuth>} />
            <Route path="/app/surveys/:id/report" element={<RequireAuth><SurveyReport /></RequireAuth>} />
            <Route path="/app/reports" element={<RequireAuth><AppShell><Reports /></AppShell></RequireAuth>} />
            <Route path="/app/audit" element={<RequireAuth><AppShell><AuditLog /></AppShell></RequireAuth>} />

            {/* Public — no login, respondent-facing */}
            <Route path="/s/:slug" element={<SurveyRunner />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function AppRoutes() {
  useDocLang();
  return <AnimatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
