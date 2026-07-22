-- Tighten the two family RPCs.
--
-- Both were created SECURITY DEFINER and granted to `authenticated`, which is
-- broader than intended. Every table in the family schema is super-admin-only,
-- but these functions bypass RLS by design — so any signed-in account, whatever
-- its role, could call them:
--
--   family_case_stats()          leaks the size and progress of the whole
--                                caseload (how many bereaved families are
--                                enrolled, how many have completed).
--   expire_stale_family_cases()  MUTATES: it flips live cases to 'expired',
--                                which would cut families off mid-assessment.
--
-- A SECURITY DEFINER function has to do its own authorisation, because there is
-- no RLS left to do it for them. Both now check the caller's role first.
--
-- Found by the Supabase security advisor after the schema went live, not by any
-- test — a grant that is too wide is invisible to a type checker and to every
-- test that runs as an administrator.

CREATE OR REPLACE FUNCTION public.expire_stale_family_cases()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH swept AS (
    UPDATE public.family_cases
       SET status = 'expired'
     WHERE expires_at < now()
       AND status IN ('not_started', 'opened', 'in_progress', 'reopened')
    RETURNING id
  )
  INSERT INTO public.family_case_events (case_id, event, actor)
  SELECT id, 'expired', 'system' FROM swept;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Rewritten as plpgsql so it can guard before it reads. A `LANGUAGE sql` body
-- cannot branch, so the authorisation check has to live in a procedural body.
CREATE OR REPLACE FUNCTION public.family_case_stats()
RETURNS TABLE (
  total bigint,
  not_started bigint,
  opened bigint,
  in_progress bigint,
  completed bigint,
  expired bigint,
  completed_today bigint,
  avg_completion_seconds numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    count(*),
    count(*) FILTER (WHERE fc.status = 'not_started'),
    count(*) FILTER (WHERE fc.status IN ('opened', 'reopened')),
    count(*) FILTER (WHERE fc.status = 'in_progress'),
    count(*) FILTER (WHERE fc.status = 'completed'),
    count(*) FILTER (WHERE fc.status = 'expired'),
    count(*) FILTER (WHERE fc.status = 'completed' AND fc.completed_at::date = now()::date),
    (SELECT avg(r.duration_seconds) FROM public.survey_responses r
      WHERE r.family_case_id IS NOT NULL AND r.duration_seconds IS NOT NULL)
  FROM public.family_cases fc;
END;
$$;

-- anon never had these; state it explicitly so a future blanket GRANT cannot
-- quietly hand a public role a caseload aggregate.
REVOKE ALL ON FUNCTION public.expire_stale_family_cases() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.family_case_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_family_cases() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.family_case_stats() TO authenticated, service_role;
