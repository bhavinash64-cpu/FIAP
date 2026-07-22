# PsyDigiHealth — Family Assessment Research Platform

Vite + React 18 + TypeScript · Tailwind + shadcn/ui · framer-motion · Supabase (Postgres, Auth, RLS, Edge Functions).

Admins build surveys from validated instruments and publish them. A field officer then
creates a **family case** per household; the system mints a secure link, a QR and a
temporary 6-digit PIN. Families sign in at `/family` with their phone number + PIN and
answer exactly one assigned assessment — no dashboard, no navigation, nothing else.

> Anonymous `/s/:slug` access was **retired** (Lane F). If you are reading older code or
> comments that describe the slug as the credential, they are stale.

---

## ⚠️ MULTI-AGENT SESSION — READ BEFORE EDITING

**Up to 5 Claude Code agents work in this repo concurrently.** Files change under you
mid-session. Two agents editing one file *will* silently overwrite each other — this
has already happened once.

### Rules

1. **Stay in your lane** (table below). Do not edit a file another lane owns, even
   for a one-line fix. Report it instead.
2. **Re-read immediately before you edit.** A `Read` from ten minutes ago is stale.
   Prefer `Edit` with a tight, unique `old_string` over `Write` — a failed match is a
   *useful* signal that the file moved; a `Write` silently destroys the other agent's work.
3. **Never `Write` a whole file you did not create in this session.**
4. **Migration filenames must be globally unique.** Use `<UTC-ish timestamp>_<topic>.sql`
   and pick a minute nobody else has. A duplicate timestamp prefix breaks `supabase db push`.
5. **Shared files** (`src/index.css`, `tailwind.config.ts`, `src/lib/i18n.ts`,
   `src/components/ui/*`) are **append-mostly**. Add tokens/keys/variants; do not
   restructure or delete another lane's entries.
6. Claim a lane by editing the table below before you start.

### Lanes

| Lane | Owns | Status |
|---|---|---|
| **A · Public assessment** | `src/components/assessment/*`, `src/pages/public/SurveyRunner.tsx`, `src/lib/{answerVisuals,assessmentSession,questionCategory}.ts`, `supabase/functions/submit-response/*`, `src/test/assessment*` | **CLAIMED — respondent-experience pass** |
| **B · Admin console** | `src/pages/admin/*` (except `QrManager.tsx`), `src/components/admin/*`, `src/components/responses/*` | free |
| **C · Data & exports** | `src/lib/{analytics,reports,exportExcel,exportHistory,responseExplorer}.ts` | free |
| **D · Distribution & marketing** | `src/pages/admin/QrManager.tsx`, `src/components/share/*`, `src/components/landing/*`, `src/pages/Landing.tsx`, `src/lib/share.ts` | **CLAIMED** |
| **E · Platform & schema** | `supabase/migrations/*`, `src/integrations/supabase/*`, `src/App.tsx`, `src/components/AppShell.tsx`, auth | **CLAIMED — F** |
| **F · Family case workflow** | `src/pages/family/*`, `src/components/family/*`, `src/lib/{familyAccess,familyCases,exportFamilies}.ts`, `supabase/functions/family-access/*`, `supabase/migrations/20260721101500_*`, `src/pages/admin/FamilyCases.tsx` | **CLAIMED** |

Unclaimed shared: `src/index.css`, `tailwind.config.ts`, `src/lib/i18n.ts`,
`src/components/ui/*` — append-mostly, per rule 5.

Co-owned A+F: `src/components/assessment/AssessmentShell.tsx` and
`AssessmentChrome.tsx`. Lane F adds header chrome through the
`AssessmentChromeProvider` context; Lane A owns the shell's layout, the progress
strip and the `SupportButton`. Extend via the context, never by adding props to
the shell.

### Lane F notes (credentialled family access)

Families no longer answer anonymously at a public slug. A field officer creates a **family
case**; the system mints a secure link, a QR and a 6-digit PIN. `/family` + PIN is the only
respondent entrance. Consequences other lanes should know about:

- **`/s/:slug` is retired at the router**, not in the page. `src/pages/public/SurveyRunner.tsx`
  (Lane A) is deliberately left on disk and untouched — `App.tsx` simply points `/s/:slug` at
  `src/pages/family/SecureAccessNotice.tsx` instead. Re-pointing the route back is a one-line
  revert if that turns out to be wrong.
- **Respondents are not database principals.** They hold no Supabase session and every table
  in the family schema revokes `anon`/`authenticated`. All respondent I/O goes through the
  `family-access` edge function as `service_role`. Do not add an RLS policy that would let
  `anon` read `family_cases` — it would dissolve the whole model.
- **Answer metadata is owned by `20260721094500_response_answer_metadata.sql`** (Lane A/E), not
  by the family migration. `completion_pct` is `GENERATED ALWAYS` from `question_count` /
  `answered_count` — never write it directly. A `skipped` row must carry no value.
- The family migration is ordered `20260721101500`, i.e. **after** the metadata one, because
  `family_case_stats()` reads `survey_responses.duration_seconds`.

---

## Design system — `src/index.css` is the single source of truth

No hex, spacing, radius, shadow, duration or easing literal belongs anywhere else.

- **Radius** — `rounded-control` (10px, buttons/chips) · `rounded-field` (12px, inputs) ·
  `rounded-surface` (16px, cards/modals) · `rounded-nav` (14px) · `rounded-pill`.
  Do not reach for `rounded-lg/xl/2xl`.
- **Type** — `.t-display .t-hero .t-title .t-section .t-card .t-body .t-caption`,
  plus `.t-question` (the assessment prompt) and `.eyebrow`. Not raw `text-sm`/`text-base`.
- **Spacing** — the 4px scale (`--space-1`…`--space-24`).
- **Shadow** — `--shadow-xs/sm/md/float` + `--highlight-top`. Elevation is
  *illumination*, not a drop shadow.
- **Motion** — `--dur-fast 140ms` / `--dur-base 220ms` / `--dur-slow 380ms`;
  `--ease-out` `--ease-in-out` `--ease-spring`. Animate transform/opacity only.
  Everything must collapse under `prefers-reduced-motion`.
- **Colour** — one saturated hue (`--primary` indigo). Gradients are banned as
  decoration. Dark mode and `html.pref-high-contrast` must both hold.

## Product rules

- **Never** mention "Government", "Governance", or any police force, department
  or jurisdiction by name anywhere. The platform is organisation-neutral:
  product name **PsyDigiHealth**, byline `orgLine` → "Family Assessment
  Research Platform". This rule used to name the specific force it was guarding
  against, which meant the banned string was itself in the repo; it is phrased
  by category now so the rule can be stated without breaking itself.
- **No WhatsApp or SMS** share channels. Email, copy-link, QR download/print only —
  a confidential well-being link must not land in a consumer messaging app.
- Bilingual EN/TE. UI chrome resolves through `useT()`; authored survey content
  through `renderBilingual()`. The toggle switches the **entire** page, never a mix.
- Nothing blocks a respondent. Required questions do not gate navigation; unanswered
  items surface on the Review stage with *Answer now* / *Submit anyway*.
- Every public assessment stage carries the floating **Help** button
  (`components/assessment/SupportButton.tsx`).

## Commands

```sh
npm run dev
npm run build       # tsc + vite build — must pass before you hand off
npm test            # vitest

# Fastest correctness gate. It MUST be -p tsconfig.app.json: the root
# tsconfig.json is a project-reference stub with "files": [], so a bare
# `npx tsc --noEmit` compiles nothing at all and is silent no matter how
# broken the tree is.
npx tsc --noEmit -p tsconfig.app.json

supabase db push
```
