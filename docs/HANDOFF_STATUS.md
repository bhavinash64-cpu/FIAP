# Family workflow — handoff status

Live project: **`atlekmwlqweqxrfbvwie`** (the one `VITE_SUPABASE_URL` points at).

`supabase/config.toml` named a *different* project, `wfuxtealkrudukvpmtrg`, from the
day it was written. That is almost certainly why the schema is live but not one
edge function is: every `supabase link` / `functions deploy` run from this repo
was aimed at a project the app never talks to. Fixed.

## Verified against the live database

| Check | Result |
|---|---|
| `family_cases`, `family_case_sessions`, `family_case_events`, `family_login_attempts` | present, RLS enabled |
| `anon` reach into those tables | **denied** — `42501 insufficient privilege`, not "relation does not exist" |
| `survey_responses` metadata (`question_count`, `answered_count`, generated `completion_pct`) | present |
| `survey_answers` metadata (`emoji`, `seconds_spent`, `skipped`, `edited`, `voice_used`) | present |
| `src/integrations/supabase/types.ts` | regenerated from the live schema |
| `src/lib/familyDb.ts` (the type shim) | **deleted** — no longer needed |
| `tsc` / tests / lint / build | 0 errors · 87 pass · clean · builds |

The anon probe is the meaningful one: it is the difference between "the tables
are missing" and "the tables exist and the public role cannot touch them". It
returned the second, which is the security model working.

## THE ONE REMAINING BLOCKER

**No edge function is deployed on `atlekmwlqweqxrfbvwie`.**

```
POST /functions/v1/family-access   -> 404 NOT_FOUND
POST /functions/v1/submit-response -> 404 NOT_FOUND
```

`family-access` is the *entire* respondent surface. Until it is deployed, family
sign-in cannot work at all — `/family` will fail on every attempt, regardless of
how correct the client and the schema are.

```sh
supabase login                       # CLI has no token in this environment
supabase functions deploy family-access
supabase functions deploy submit-response   # optional: the anonymous path is retired
```

`config.toml` already sets `verify_jwt = false` for `family-access`, which is
required — respondents hold no Supabase JWT by design; the function authenticates
them itself against the case PIN and its own session token.

Verify afterwards:

```sh
curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/family-access" \
  -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"action":"resolve","token":"bogus"}'
# expect {"state":"not_found"} — a 404 means it is still not deployed
```

## Security advisor — findings in THIS feature

Fixed in `20260722120000_restrict_family_rpcs.sql` (applied):

- `family_case_stats()` and `expire_stale_family_cases()` were `SECURITY DEFINER`
  and granted to `authenticated`. Any signed-in account — not just a super admin —
  could read caseload aggregates, and `expire_stale_family_cases()` **mutates**:
  it flips live cases to `expired`, cutting families off mid-assessment. A
  `SECURITY DEFINER` function has to do its own authorisation because it has
  switched RLS off; both now check `has_role(auth.uid(), 'super_admin')` first.

Reported by the advisor and **intentional, not bugs**:

- `family_case_sessions` and `family_login_attempts` have RLS enabled with no
  policy. That is the design: no policy plus no grant means nothing but
  `service_role` can read them. A stolen session must not be forgeable from
  inside the console either.

## Pre-existing findings NOT from this feature — worth triaging

These come from the older clinical-research schema and are outside the family
workflow, but they are live on the same database:

- **`patient_portal(p_code, p_dob)` is executable by `anon`** as `SECURITY
  DEFINER`. A participant code plus a date of birth is a guessable pair; this is
  the highest-risk item on the list.
- `save_response`, `complete_survey`, `get_survey`, `due_reminders`,
  `log_notification`, and the `demo_*` family are all `anon`-executable
  `SECURITY DEFINER` functions.
- Views `study_scores`, `study_participants`, `study_assignments` are
  `SECURITY DEFINER` (advisor level: **ERROR**).
- Leaked-password protection is disabled in Supabase Auth.

## Still not done

The full respondent journey has never been run end to end — it cannot be until
`family-access` is deployed. Create a case, scan the QR, enter the PIN, answer,
skip one deliberately, submit, then confirm in the database that the skipped
question wrote a row with `skipped = true` and **no** value, and that
`completion_pct` computed itself from the two counts.
