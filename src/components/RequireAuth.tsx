import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, isSuperAdmin } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background px-6 text-center">
        <div>
          <div className="text-lg font-semibold">Access restricted</div>
          <p className="mt-1 text-sm text-muted-foreground">This account is not authorised to access the admin console.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
