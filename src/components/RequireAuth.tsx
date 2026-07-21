import { ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { hasRespondentSession } from "@/lib/familyAccess";

/* The gate — the first surface anyone sees. It should feel like the product
   is thinking, not like a page is buffering. No spinner. */

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, isSuperAdmin } = useAuth();
  const reduce = useReducedMotion();
  const loc = useLocation();

  /*
     A signed-in family that types or follows an /app URL is sent back to their
     own assessment, not to the administrator sign-in page. Checked before the
     auth `loading` gate because a respondent holds no Supabase session at all —
     waiting on one would leave them staring at a pulsing logo before landing on
     a login form they have no credentials for. This is a redirect, never an
     error: they have not done anything wrong, and the admin console must simply
     not be a place they can arrive.
  */
  if (hasRespondentSession() && !user) {
    return <Navigate to="/family/assessment" replace />;
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <motion.div
          initial={{ opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
          transition={reduce ? { duration: 0.3 } : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Logo size={52} />
        </motion.div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;

  if (!isSuperAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
          className="max-w-[26rem] text-center"
        >
          <Logo size={64} className="mx-auto" />
          <h1 className="t-section mt-6">This workspace is private</h1>
          <p className="mt-3 t-body text-muted-foreground">
            {user.email} doesn’t have access to the admin console. Sign in with an
            authorized account to continue.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild>
              <Link to="/">Back to home</Link>
            </Button>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
