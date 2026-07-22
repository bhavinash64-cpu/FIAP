-- =========================================================
-- Make every admin query stop re-checking the caller's role once per row.
--
-- THE PROBLEM
-- 43 policies are written as:
--
--     USING (has_role(auth.uid(), 'super_admin'))
--
-- Both `auth.uid()` and `has_role()` are STABLE, not IMMUTABLE, and they appear
-- as a plain function call in the policy expression. Postgres therefore
-- evaluates the pair FOR EVERY ROW the statement touches. `has_role` is itself
-- a lookup into user_roles, so reading N rows from survey_questions costs N
-- extra index probes purely to re-answer a question whose answer cannot change
-- during the statement.
--
-- THE FIX
-- Wrap the check in a scalar subquery:
--
--     USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin')))
--
-- A subquery with no outer references is hoisted into an InitPlan and executed
-- ONCE per statement, its result reused for every row. This is the documented
-- Supabase remedy for the `auth_rls_initplan` lint. The predicate is logically
-- identical — same function, same argument, same result — so no policy grants
-- or denies anything it did not before.
--
-- A useful side effect: multiple permissive policies on one table are combined
-- with OR, so an admin's now-constant `true` short-circuits the OTHER policy's
-- per-row EXISTS(...) subquery on survey_questions / survey_question_options /
-- survey_sections. That per-row join into `surveys` was the real cost on the
-- builder screens, and it disappears for admins without touching those
-- policies at all.
--
-- Driven off the catalogue rather than a hardcoded list of 43 statements: it
-- matches only policies whose predicate is EXACTLY the pure role check, so a
-- policy that also inspects row data is never rewritten by accident. Rewriting
-- changes the stored expression, so a second run matches nothing — idempotent.
-- =========================================================

DO $mig$
DECLARE
  p       record;
  target  text := 'has_role(auth.uid(), ''super_admin''::app_role)';
  wrapped text := '(SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role))';
  n       int  := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = target OR with_check = target)
  LOOP
    -- USING and WITH CHECK are altered independently: ALTER POLICY leaves the
    -- clause it is not given untouched, so an UPDATE policy carrying both keeps
    -- both, and an INSERT policy (WITH CHECK only) is not handed a USING it
    -- cannot have.
    IF p.qual = target THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
                     p.policyname, p.schemaname, p.tablename, wrapped);
    END IF;
    IF p.with_check = target THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                     p.policyname, p.schemaname, p.tablename, wrapped);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'hoisted % pure role-check policies', n;
END;
$mig$;

-- The three policies that mix the role check with row data, rewritten by hand
-- for the same reason. Predicates are unchanged apart from the hoist.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='user_roles'
               AND policyname='Users view own roles') THEN
    ALTER POLICY "Users view own roles" ON public.user_roles
      USING (user_id = (SELECT auth.uid())
             OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='profiles'
               AND policyname='profiles_self_read') THEN
    ALTER POLICY profiles_self_read ON public.profiles
      USING (id = (SELECT auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='audit_logs'
               AND policyname='Any authenticated insert audit') THEN
    ALTER POLICY "Any authenticated insert audit" ON public.audit_logs
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END;
$mig$;

-- ---------------------------------------------------------
-- Covering indexes for the foreign keys the live app actually joins or
-- cascades on. An unindexed FK makes the referenced side's DELETE scan the
-- whole child table, and makes the reverse lookup a sequential scan.
-- Legacy prototype tables are left alone.
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_family_cases_response
  ON public.family_cases(response_id) WHERE response_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_surveys_created_by
  ON public.surveys(created_by);

CREATE INDEX IF NOT EXISTS idx_survey_questions_source_ref
  ON public.survey_questions(source_ref) WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qb_instruments_created_by
  ON public.question_bank_instruments(created_by);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.audit_logs(user_id);

-- survey_answers is the widest table in the live model and is always read by
-- response; survey_responses is always listed newest-first per survey.
CREATE INDEX IF NOT EXISTS idx_survey_answers_response
  ON public.survey_answers(response_id);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_submitted
  ON public.survey_responses(survey_id, submitted_at DESC);
