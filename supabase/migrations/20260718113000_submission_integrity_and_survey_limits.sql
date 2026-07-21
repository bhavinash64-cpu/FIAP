-- Keep public wellbeing surveys short and make the submission rate limit atomic.
CREATE OR REPLACE FUNCTION public.enforce_published_survey_question_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE question_total integer;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.id;
  IF question_total > 20 THEN
    RAISE EXCEPTION 'Published surveys are limited to 20 questions; split this survey into reviewed modules.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.enforce_question_limit_on_question_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE question_total integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.surveys WHERE id = NEW.survey_id AND status = 'published') THEN
    SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.survey_id;
    IF question_total >= 20 THEN
      RAISE EXCEPTION 'Published surveys are limited to 20 questions; split this survey into reviewed modules.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_question_limit_on_question_write ON public.survey_questions;
CREATE TRIGGER trg_enforce_question_limit_on_question_write BEFORE INSERT OR UPDATE OF survey_id ON public.survey_questions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_question_limit_on_question_write();

DROP TRIGGER IF EXISTS trg_enforce_published_survey_question_limit ON public.surveys;
CREATE TRIGGER trg_enforce_published_survey_question_limit BEFORE INSERT OR UPDATE OF status ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_published_survey_question_limit();

CREATE TABLE IF NOT EXISTS public.survey_submission_rate_limits (
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  last_submitted_at timestamptz NOT NULL DEFAULT now(),
  daily_window_started_at timestamptz NOT NULL DEFAULT now(),
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  PRIMARY KEY (survey_id, ip_hash)
);
ALTER TABLE public.survey_submission_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.survey_submission_rate_limits FROM anon, authenticated;
GRANT ALL ON public.survey_submission_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.claim_survey_submission_slot(
  p_survey_id uuid, p_ip_hash text, p_min_interval_seconds integer DEFAULT 300, p_max_per_day integer DEFAULT 20
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rate_row public.survey_submission_rate_limits; now_at timestamptz := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_survey_id::text || p_ip_hash, 0));
  SELECT * INTO rate_row FROM public.survey_submission_rate_limits
  WHERE survey_id = p_survey_id AND ip_hash = p_ip_hash FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.survey_submission_rate_limits (survey_id, ip_hash, last_submitted_at, daily_window_started_at, daily_count)
    VALUES (p_survey_id, p_ip_hash, now_at, now_at, 1);
    RETURN true;
  END IF;
  IF rate_row.last_submitted_at > now_at - make_interval(secs => p_min_interval_seconds) THEN RETURN false; END IF;
  IF rate_row.daily_window_started_at <= now_at - interval '24 hours' THEN
    UPDATE public.survey_submission_rate_limits SET last_submitted_at = now_at, daily_window_started_at = now_at, daily_count = 1
    WHERE survey_id = p_survey_id AND ip_hash = p_ip_hash;
    RETURN true;
  END IF;
  IF rate_row.daily_count >= p_max_per_day THEN RETURN false; END IF;
  UPDATE public.survey_submission_rate_limits SET last_submitted_at = now_at, daily_count = daily_count + 1
  WHERE survey_id = p_survey_id AND ip_hash = p_ip_hash;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_survey_submission_slot(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_survey_submission_slot(uuid, text, integer, integer) TO service_role;


