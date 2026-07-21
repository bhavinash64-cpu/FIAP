import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { hasRespondentSession } from "@/lib/familyAccess";

/* The respondent gate. Everything behind it belongs to exactly one family and
   exactly one assessment.

   The rule: this component never renders a loading state. The session token
   lives in localStorage, so `hasRespondentSession()` answers synchronously on
   the first paint — there is nothing to await and therefore nothing to spin
   for. A family opening their link on a borrowed phone in a village should see
   either their assessment or the sign-in screen, never a flash of "checking…".
   (Token validity is still the server's call; `family-access` rejects a stale
   token on resume and that screen handles it. This gate only answers the cheap
   question: is there a token at all?) */

export function RequireRespondent({ children }: { children: ReactNode }): JSX.Element {
  // No `state={{ from }}`: a respondent has no intended destination worth
  // preserving. There is exactly one page they can reach, and signing in takes
  // them straight into it.
  if (!hasRespondentSession()) return <Navigate to="/family" replace />;

  return <>{children}</>;
}
