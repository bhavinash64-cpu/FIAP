# Jeevana Insight — credentialled family assessment workflow

Turns the platform from an anonymous survey tool into a controlled research
instrument. A field officer creates a **family case** per household; the system
mints a secure link, a QR and a temporary 6-digit PIN. Families sign in at
`/family` and answer exactly one assigned assessment — no dashboard, no
navigation, nothing else.

## The security model, stated once

A respondent is **never a database principal**. They hold no Supabase session and
no table grant — every table in the family schema revokes `anon` and
`authenticated`. All respondent I/O goes through one edge function,
`family-access`, running as `service_role`, which resolves an opaque session
token to exactly one `family_cases` row and refuses to look anywhere else.

That is why "a family can only reach their own assessment" is a structural fact
rather than a UI convention: there is no endpoint that would return anything
else, and no credential that would be accepted if there were.

Defences layered on top:

| Threat | Defence |
|---|---|
| Brute-forcing one known family's PIN | 5 attempts → case locked 15 min |
| Blind sweep of the 10⁶ PIN space | 30 login attempts per IP per 15 min |
| Timing analysis on the PIN compare | Length-independent constant-time compare |
| Stolen DB dump replaying a session | Only the SHA-256 of a session token is stored |
| Shared handset reopened after submit | Submitting revokes the case's sessions |
| Enumerating enrolled families | One error for wrong-phone and wrong-PIN alike |
| A leaked survey slug | `/s/:slug` retired — see below |

**`/s/:slug` is retired.** It served a full assessment to anyone holding a slug,
which made the PIN decorative: a forwarded link was an uncredentialled way into
the same instrument. It is retired *at the router*, so `SurveyRunner.tsx` stays
intact on disk and re-pointing the route back is a one-line revert.

## What's in it

**Respondent** — separate login (`/family`, `/family/:token`), one question per
screen, large answer cards, emoji, voice playback, skip/previous/next, progress
and time remaining, review stage with *Answer now* / *Submit anyway*, and a
terminal thank-you carrying a Reference Number and Assessment ID.

Autosave is two-tier: a synchronous local snapshot on every change, plus a
debounced server draft. The local tier survives a killed tab; the server tier is
what lets a family start on the officer's tablet and finish on their own phone.
Offline is handled explicitly and flushed on reconnect.

**Administrator** — a Family Cases module: create a case, mint credentials, print
a bilingual slip, track status (Not started / Opened / In progress / Completed /
Expired / Reopened), walk the caseload with a keyboard, and read a per-case
timeline. Regenerating a PIN or link invalidates what the family holds; viewing a
PIN is itself an audited event.

**Research output** — Excel, Word and PDF, all from Responses. The Excel matrix
is one row per family, one column per question, plus a codebook, long-format
answer detail and a case log. A deliberately skipped question reads `[SKIPPED]`;
a question never reached is genuinely empty — that distinction is the whole point
of the per-answer metadata, and collapsing it would report a refusal as a missing
value.

## Two decisions worth reviewing

**PDF renders through the browser print pipeline, not a JS PDF library.** jsPDF
and pdfmake ship Latin-only core fonts. Telugu is an abugida needing glyph
substitution and reordering; without a shaped font it comes out as tofu or, worse,
silently reordered syllables — a report that looks fine to a reviewer who cannot
read it. The browser already shapes Telugu correctly. Documented at the top of
`src/lib/exportDocuments.ts` so nobody "upgrades" it later.

**Word is a Word-compatible HTML `.doc`, not a generated `.docx`.** Word opens it
natively with tables and Unicode intact, for no dependency. The UTF-8 BOM is
load-bearing: without it some Word builds fall back to the system codepage and
every Telugu answer becomes mojibake.

## Also in this branch

- **Dashboard rebuilt.** The previous version drew the *same* 14-day series twice
  — a sparkline in the hero tile and a full panel directly beneath it — and spent
  a donut chart on three numbers. Removing that duplication paid for real
  analytics on the first screen: trend with 7d/30d/12m, completion, median time,
  language mix. Five stacked rows became three bands.
- **Login layout** at three parts visual to one part form, with the headline and
  sculpture as one optically-centred group.
- **Language toggle fix.** The active pill used `-z-10`, which escapes the button
  and paints against the nearest stacking context — so on any `backdrop-blur` bar
  the header's own background covered it and the selected label rendered
  white-on-white. Fixed in the component, so it holds wherever the toggle is placed.
- **Question Library and Export Center hidden** from navigation; both routes kept
  for bookmarks.

## Verification

```
npx tsc -p tsconfig.app.json --noEmit    0 errors
npm test                                 84 passed (5 files)
npm run build                            ✓ built in 14.06s
npx eslint src --ext .ts,.tsx            clean
```

Dev server boots; `/`, `/auth`, `/family` and `/app/families` all return 200.

## Before merging

1. **Apply the migrations** if any environment is behind — `supabase db push`, or
   paste `docs/APPLY_PENDING_MIGRATIONS.sql`. Order matters:
   `20260721094500_response_answer_metadata.sql` must run before
   `20260721101500_family_case_workflow.sql`, because `family_case_stats()` reads
   `survey_responses.duration_seconds` and a `LANGUAGE sql` body is validated at
   CREATE time.
2. **Deploy the edge function** — `supabase functions deploy family-access`.
3. **Regenerate `src/integrations/supabase/types.ts`.** It still predates these
   migrations. `src/lib/familyDb.ts` declares the gap once as a real schema so
   every call site stays type-checked; once types.ts is current, repoint the
   imports and delete that module.

## Known gap

The full respondent journey has been verified by compiler, tests and build — not
by a live end-to-end run against a populated database. The walkthrough in
`docs/` (create case → scan QR → PIN → answer → skip → submit → verify rows)
should be treated as the real acceptance test.
