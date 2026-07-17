import { ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

/* The gate — the first surface anyone sees. It should feel like the product
   is thinking, not like a page is buffering. No spinner. */

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, isSuperAdmin } = useAuth();
  const reduce = useReducedMotion();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <motion.div
          initial={{ opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
          transition={reduce ? { duration: 0.3 } : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrandMark className="h-8 w-8" />
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
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <BrandMark className="h-7 w-7" />
          </span>
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
