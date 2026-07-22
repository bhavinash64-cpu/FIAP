-- Sign-in becomes: the secure link, plus the family's own phone number.
--
-- The 6-digit PIN is removed at the product owner's direction: a family should
-- type one thing they already know, not a code off a slip they can lose.
--
-- What that means for the threat model, stated plainly because the next person
-- to read this needs to know exactly what is and is not protecting the data:
--
--   A phone number is NOT a secret. It is on the case file, known to relatives
--   and neighbours, and a 10-digit Indian mobile is guessable within a district.
--   So the phone number cannot be the thing that keeps a stranger out.
--
--   The ACCESS TOKEN is. It is 22 characters from a 31-symbol alphabet (~109
--   bits), minted per case, and it only ever exists on the printed slip and in
--   the QR. Login therefore REQUIRES the token; the phone is a second factor
--   that confirms the right family is holding the right slip.
--
-- Hence: the PIN column is retired, but the login path is NOT loosened to
-- "phone alone". Anything that made /family reachable without a token would
-- make every household's answers readable to anyone who can guess a number.

-- Login no longer resolves a (phone, pin) pair, so that pair need not be unique.
DROP INDEX IF EXISTS public.uq_family_cases_phone_pin;

-- Kept, not dropped: existing rows keep whatever PIN they were issued, and an
-- audit trail that references pin_viewed stays meaningful. New cases simply
-- leave it NULL.
ALTER TABLE public.family_cases ALTER COLUMN pin DROP NOT NULL;
ALTER TABLE public.family_cases ALTER COLUMN pin DROP DEFAULT;

ALTER TABLE public.family_cases DROP CONSTRAINT IF EXISTS family_cases_pin_check;
ALTER TABLE public.family_cases
  ADD CONSTRAINT family_cases_pin_check CHECK (pin IS NULL OR pin ~ '^[0-9]{6}$');

COMMENT ON COLUMN public.family_cases.pin IS
  'Retired. Sign-in is access_token + phone. NULL on every case created after 2026-07-22.';
COMMENT ON COLUMN public.family_cases.access_token IS
  'THE credential. ~109 bits of entropy, per case, on the printed slip and in the QR. The phone number confirms identity but is not secret and must never be sufficient on its own.';

-- One family, one live case per assigned survey. With the PIN gone the token
-- identifies the case and the phone confirms it, so two open cases for the same
-- household on the same instrument would make "which one did they just answer"
-- ambiguous. Completed and expired rows are excluded so a legitimate re-run is
-- still possible.
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_cases_active_phone_survey
  ON public.family_cases (phone, survey_id)
  WHERE status IN ('not_started', 'opened', 'in_progress', 'reopened');
