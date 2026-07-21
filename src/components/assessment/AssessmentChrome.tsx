import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Chrome that belongs to the whole assessment rather than to any one stage.
 *
 * Every stage renders its own <AssessmentShell>, so anything that must appear
 * on all of them — the credentialled family's "Leave" control, the save
 * indicator — would otherwise have to be threaded as props through Welcome,
 * Question, Review and Thank-you alike, and re-threaded every time a stage is
 * added. A context lets the container declare it once.
 *
 * Absent by default: the anonymous preview surfaces mount the same stages with
 * no provider and get exactly the shell they had before.
 */

interface AssessmentChromeValue {
  /** Rendered at the trailing edge of the shell header, before the language toggle. */
  headerAction?: ReactNode;
  /** A quiet line under the product name — the family's reference id. */
  identityLine?: string;
}

const AssessmentChromeContext = createContext<AssessmentChromeValue>({});

export function AssessmentChromeProvider({
  headerAction,
  identityLine,
  children,
}: AssessmentChromeValue & { children: ReactNode }) {
  const value = useMemo(() => ({ headerAction, identityLine }), [headerAction, identityLine]);
  return <AssessmentChromeContext.Provider value={value}>{children}</AssessmentChromeContext.Provider>;
}

export function useAssessmentChrome() {
  return useContext(AssessmentChromeContext);
}
