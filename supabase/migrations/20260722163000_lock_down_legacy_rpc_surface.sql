-- =========================================================
-- Close the legacy prototype's API surface.
--
-- THE PROBLEM
-- An earlier "psydigihealth" prototype left a complete second application
-- behind in this database: participants, responses, scores, consents,
-- notifications — and a set of SECURITY DEFINER functions that PostgREST
-- exposes as RPC endpoints callable by `anon`, i.e. by anyone holding the
-- publishable key that ships in the browser bundle. Among them:
--
--   patient_portal(p_code, p_dob)   — authenticates a participant from a code
--                                     and a date of birth, both low-entropy
--   get_survey(p_token)             — reads an assignment's whole instrument
--   save_response(p_token, ...)     — writes answers
--   complete_survey(p_token)        — marks an assignment finished
--   demo_register(...)              — inserts a participant row
--   demo_consent(...)               — records a consent decision
--   demo_batches() / demo_catalogue()
--   due_reminders(p_secret)         — shared-secret gated, still anon-callable
--   log_notification(p_secret, ...) — same
--
-- Because they are SECURITY DEFINER they run as their owner and bypass RLS
-- entirely, so the tables' policies are not a second line of defence. Those
-- tables are not empty: they hold real participant, response and consent rows.
--
-- None of this is reachable from the product. The app is the survey/family-case
-- model, and it calls none of these — verified by grep across src/ and
-- supabase/functions/; the names appear only in the generated types file.
-- They are pure attack surface: an unauthenticated second door into
-- participant data, sitting beside the deliberately narrow family-access
-- function that the current design depends on.
--
-- THE FIX
-- Revoke EXECUTE from PUBLIC, anon and authenticated. The functions and their
-- data stay exactly as they are — only the ability to call them over the API
-- goes. service_role and the owner are unaffected, so anything server-side
-- still works and nothing is destroyed. Re-granting is a one-line revert.
--
-- Also flips three SECURITY DEFINER views to security_invoker. A definer view
-- applies its CREATOR's permissions and RLS to every reader, which is the same
-- privilege-escalation shape in view form.
--
-- Written as catalogue-driven loops, not a hardcoded list: these objects were
-- created by migrations that live only in the remote project and have never
-- been in this repo, so a fresh `supabase db push` has none of them. A literal
-- REVOKE would fail there. This finds what exists and leaves the rest alone.
-- Idempotent.
-- =========================================================

DO $mig$
DECLARE
  f record;
  n int := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prosecdef                       -- SECURITY DEFINER only
      AND p.proname IN (
        'patient_portal',
        'get_survey',
        'save_response',
        'complete_survey',
        'demo_register',
        'demo_consent',
        'demo_batches',
        'demo_catalogue',
        'due_reminders',
        'log_notification'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    n := n + 1;
    RAISE NOTICE 'revoked %', f.sig;
  END LOOP;
  RAISE NOTICE 'legacy RPCs closed: %', n;
END;
$mig$;

-- Trigger functions are not callable as RPC in any useful way, but PostgREST
-- still advertises them. Nothing should hold EXECUTE on a trigger function.
DO $mig$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE ns.nspname = 'public' AND t.typname = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END;
$mig$;

-- SECURITY DEFINER views → security_invoker, so a reader sees only what their
-- own grants and RLS allow rather than the view owner's.
DO $mig$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['study_scores', 'study_participants', 'study_assignments'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = v
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
      RAISE NOTICE 'view %: security_invoker on, anon revoked', v;
    END IF;
  END LOOP;
END;
$mig$;
