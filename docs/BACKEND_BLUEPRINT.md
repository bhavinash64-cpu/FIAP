# PsyDigiHealth — New Supabase Backend: Complete Implementation Plan

> **Status: ANALYSIS ONLY. Nothing has been created, migrated, or deployed.**
> This is the reviewable blueprint for rebuilding the deleted backend from scratch.
> Derived by reverse-engineering the **actual** source: `docs/deploy/full_schema.sql`,
> the 23 files in `supabase/migrations/`, the 3 edge functions, and every
> `supabase.*` call in `src/`. Every claim is grounded in that code — not guessed.

---

## 0. Verdict & source of truth

**Completeness audit (frontend contract vs. schema) — PASS, zero gaps:**

| Dimension | App requires | Present in schema | Result |
|---|---|---|---|
| Tables the frontend reads/writes | 15 | 15 | ✅ 15/15 |
| RPC functions the frontend calls | 12 | 12 | ✅ 12/12 |
| Edge functions the frontend invokes | 3 | 3 | ✅ 3/3 |
| Auth methods used | 5 (all stock Supabase Auth) | — | ✅ |
| Storage buckets the **frontend** touches | 0 (bucket is edge/admin-only) | 1 | ✅ N/A |

**The authoritative complete SQL already exists and is verified: `docs/deploy/full_schema.sql`**
(3208 lines, idempotent, = all 23 migrations concatenated in order, including the
question-bank seed and the storage bucket). **Do not hand-rewrite it** — regenerating
3208 lines of DDL by hand would only introduce divergence. The plan below deploys that
file (or the 23 migrations individually) and documents exactly what it contains.

---

## 1. Backend blueprint — what the application requires

### 1.1 Extensions (1)
- **`pgcrypto`** — required for `gen_random_bytes(16)` used by `create_due_family_followups()` to mint follow-up access tokens. Created with a guarded `DO` block (not bare `CREATE EXTENSION IF NOT EXISTS`, which errors on some managed Supabase roles).
- `gen_random_uuid()` (every PK default) is **core Postgres 13+** — needs no extension. No `uuid-ossp`, no other extension anywhere.

### 1.2 Enum types (8, schema `public`)

| Enum | Values |
|---|---|
| `app_role` | `admin`, `staff`, `researcher`, `analyst`, `user`, `super_admin` |
| `study_group` | `case`, `control` |
| `instrument_type` | `DEMOGRAPHIC`, `PID5BF`, `IRI`, `CIUS`, `DIGITAL_USE`, `SUICIDE_HISTORY` |
| `session_status` | `in_progress`, `completed`, `abandoned` |
| `survey_status` | `draft`, `published`, `closed` |
| `question_kind` | `multiple_choice`, `checkboxes`, `likert5`, `yes_no`, `rating5`, `short_text`, `long_text`, `dropdown` |
| `question_origin` | `manual`, `voice`, `pdf` |
| `family_case_status` | `not_started`, `opened`, `in_progress`, `completed`, `expired`, `reopened` |

### 1.3 Tables (24 in `public`), grouped by role

**Identity & roles** *(trigger/RLS-managed)*
- `profiles` — one row per `auth.users` (name, phone, district, language). Trigger-seeded.
- `user_roles` — role assignments; `UNIQUE(user_id, role)`. Gates the whole console.
- `audit_logs` — append-only admin action log.

**Survey engine (current core — app reads/writes)**
- `surveys` — publishable instrument; `UNIQUE(slug)`; question-count cap enforced by trigger (final cap **25**).
- `survey_sections` — ordered question groups within a survey.
- `survey_questions` — questions; FK → survey (CASCADE), section (SET NULL), import batch (SET NULL).
- `survey_question_options` — options per question.
- `survey_responses` — one submission; has `GENERATED ALWAYS` `completion_pct`, sanity CHECKs, `family_case_id`/`reference_id` link.
- `survey_answers` — one row per (response, question); `UNIQUE(response_id, question_id)`; metadata cols (emoji, seconds_spent, skipped, edited, voice_used) + CHECKs (skipped rows carry no value).
- `survey_views` — page-load telemetry (anon-insertable on published surveys).
- `import_batches` — provenance for PDF/voice question imports.
- `survey_submission_rate_limits` — **service_role only**; per-(survey, ip_hash) anti-spam counters.

**Question bank v2 (admin authoring — app reads/writes)**
- `question_bank_instruments` — reusable instrument groups; `UNIQUE(code)`. Seeded with 8 built-ins/128 items + a 9th `INTERVIEW`/22 items.
- `question_bank_items` — questions within a bank instrument.
- `question_bank_item_options` — options per bank item.

**Family case workflow (credentialled — app reads/writes cases + events)**
- `family_cases` — the case; `reference_id` (`PDH-YYYY-#####` via sequence), `access_token`, optional `pin`, status lifecycle, draft autosave, longitudinal follow-up columns, self-FK `followup_parent_id`. FK → survey is **RESTRICT** (can't delete a survey with live cases).
- `family_case_sessions` — **service_role only**; stores only SHA-256 hashes of session tokens.
- `family_case_events` — per-case audit timeline.
- `family_login_attempts` — **service_role only**; per-IP login throttle.

**Legacy clinical schema (kept, but UNUSED by the current app)**
- `participants`, `assessment_sessions`, `assessment_responses`, `question_bank`, `question_option`.
  Left in place for history; no `src/` code references them. Safe to keep (they deploy cleanly) or drop later if you want a leaner DB — not required for the app to run.

> **Frontend actually uses 15 tables** (the survey-engine + question-bank v2 + `family_cases`/`family_case_events` + `user_roles`/`audit_logs`). `profiles` is trigger-managed; 3 tables are edge-function-only; 5 are legacy. 15 + 1 + 3 + 5 = 24. ✅

### 1.4 Key relationships
- Everything user-owned FKs to `auth.users(id)` (profiles, user_roles, surveys.created_by, family_cases.officer_id, …).
- Survey chain (all CASCADE from `surveys`): sections, questions→options, responses→answers, views, import_batches, rate_limits.
- Family chain (from `family_cases`): sessions, events (CASCADE); self-FK for follow-up rounds (SET NULL); bidirectional link with `survey_responses`.

### 1.5 Indexes
~30 explicit `CREATE INDEX` (all default **btree**), of which:
- **1 UNIQUE (final state):** `uq_family_cases_active_phone_survey (phone, survey_id) WHERE status IN ('not_started','opened','in_progress','reopened')` — one active case per family+survey. *(An earlier `uq_family_cases_phone_pin` is created then DROPPED by the phone-only migration.)*
- **6 partial indexes** (skipped answers, active family cases, follow-up due/parent, non-null response/source_ref).
- Covering FK indexes added by the RLS-initplan migration.
- Plus implicit btrees from every PK / UNIQUE constraint.

### 1.6 Storage — exactly one bucket
- **`survey-imports`** — **private** (`public = false`). Holds uploaded source PDFs for audit only. **No public/avatar/family bucket exists.**
- Three `storage.objects` RLS policies, all `super_admin`-gated and scoped to `bucket_id = 'survey-imports'`: SELECT, INSERT, DELETE (no UPDATE).

```sql
-- Storage creation (already inside full_schema.sql; shown for review)
INSERT INTO storage.buckets (id, name, public)
VALUES ('survey-imports', 'survey-imports', false)
ON CONFLICT (id) DO NOTHING;

-- + 3 policies on storage.objects, each:
--   USING/WITH CHECK (bucket_id = 'survey-imports' AND public.has_role(auth.uid(),'super_admin'))
```

### 1.7 Functions & triggers

**Functions (grouped):**
- *Auth/RLS helpers* — `has_role`, `current_user_has_any_role` (both SECURITY DEFINER, used inside policies), `handle_new_user` (signup trigger fn — seeds `profiles` + a `user` role).
- *Utility* — `tg_set_updated_at` (backs ~11 `BEFORE UPDATE` triggers).
- *Survey builder (INVOKER)* — `reorder_survey_questions`, `reorder_survey_sections`, `reorder_survey_options`, `reorder_question_bank_items`.
- *Limit enforcers (DEFINER, trigger)* — `enforce_published_survey_question_limit`, `enforce_question_limit_on_question_write` (cap = 25).
- *Rate-limit / lockout (DEFINER, service_role only)* — `claim_survey_submission_slot`, `claim_family_login_attempt`.
- *Family RPCs (DEFINER, self-check `super_admin`)* — `expire_stale_family_cases`, `family_case_stats`, `create_due_family_followups`.
- *Analytics (INVOKER, granted authenticated)* — `survey_response_stats`, `survey_response_timeseries`, `question_value_counts`, `survey_period_comparison`.
- *Misc* — `survey_list_counts` (INVOKER), `next_family_reference_id` (sequence-backed default for `family_cases.reference_id`).

**Triggers:** `on_auth_user_created` (AFTER INSERT on `auth.users` → `handle_new_user`); ~11 `trg_*_updated` (`BEFORE UPDATE` → `tg_set_updated_at`); 2 question-limit enforcers on `surveys` / `survey_questions`.

### 1.8 RLS / security posture
- **24 tables have RLS enabled.** Console is uniformly gated on the single **`super_admin`** role via `has_role()`.
- **`anon`** may only: SELECT published survey content (`surveys`/`survey_questions`/`survey_question_options`/`survey_sections`) and INSERT `survey_views`. Nothing else.
- **Respondents are not database principals.** All family + rate-limit tables (`family_cases`, `family_case_sessions`, `family_case_events`, `family_login_attempts`, `survey_submission_rate_limits`) revoke `anon`/`authenticated`; only `service_role` (via edge functions) touches them.
- **Response write path is closed to clients** — `survey_responses`/`survey_answers` INSERT policies were dropped, so only `service_role` (the `submit-response` / `family-access` functions) can write submissions.

---

## 2. Edge functions — deployment plan

All three are self-contained single `index.ts` files (no shared imports, no import map).

| Function | `verify_jwt` | Secrets | Auth model |
|---|---|---|---|
| **submit-response** | **`false`** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — **auto-injected** (no manual set) | Anonymous public writes; server-side IP-hash rate limit + published-survey check; runs as service_role |
| **family-access** | **`false`** ⚠️ | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — **auto-injected** | Self-authenticates via link access-token + phone → hashed session token; service_role |
| **extract-questions** | **`true`** | `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY` — **must be set manually** (≥1) | Admin-only; platform enforces Supabase JWT; no DB access, calls external LLM |

> ⚠️ **`family-access` MUST stay `verify_jwt = false`.** Respondents hold no Supabase JWT by design; the function authenticates them itself. Setting it `true` returns 401 to every family and silently kills the entire respondent flow. (Same for `submit-response`.)

---

## 3. Auth configuration

**Project settings (match `supabase/config.toml`):**
- **Public signup: DISABLED** (`enable_signup = false`, globally + email provider).
- **Email confirmations: DISABLED** (`enable_confirmations = false`).
- The frontend only calls `signInWithPassword` — there is no `signUp` UI anywhere.

**Role model:**
- Console access = an `auth.users` row **whose `user_roles` contains `super_admin`**. No other value (`admin/staff/researcher/analyst/user`) satisfies the `RequireAuth` gate or the post-backfill RLS.
- The `on_auth_user_created` trigger auto-grants every new user role **`user`** (not admin) — so account creation alone never grants console access; a promotion step is mandatory.

**First-admin bootstrap (required — signup is off):**
1. **Dashboard → Authentication → Users → Add user** (email + password, **Auto Confirm** on). This fires the trigger, creating a `profiles` row + a `user` role row.
2. **SQL Editor** — promote to console role:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'super_admin'::public.app_role
   FROM auth.users WHERE email = 'you@example.org'
   ON CONFLICT (user_id, role) DO NOTHING;
   ```
3. Sign in at `/auth`. `isSuperAdmin` becomes true and `/app` opens.

---

## 4. Deployment plan (ordered — review before running)

**Supabase-side (via the Supabase MCP / connector):**

| Step | Action | Tool / place | Verify |
|---|---|---|---|
| 0 | Create fresh project (`psydigihealth`, region `ap-south-1`) | `get_cost` → `confirm_cost` → `create_project` | `get_project` = ACTIVE_HEALTHY |
| 1 | Ensure `pgcrypto` | `execute_sql`: `create extension if not exists pgcrypto with schema extensions;` | — |
| 2 | **Apply schema** — the 23 files in `supabase/migrations/` **in filename order**, one `apply_migration` each (records migration history). *Fallback:* one `execute_sql` of `docs/deploy/full_schema.sql`. Includes enums, 24 tables, indexes, RLS, functions, triggers, the `survey-imports` bucket + policies, and the question-bank seed. | `apply_migration` ×23 | `list_migrations` = 23 |
| 3 | Verify tables | `list_tables` | expect **24** public tables + `survey-imports` bucket |
| 4 | Advisors | `get_advisors(security)` / `(performance)` | fix any critical |
| 5 | Deploy the 3 edge functions with the exact `verify_jwt` from §2 | `deploy_edge_function` ×3 | `list_edge_functions` |
| 6 | Auth settings: disable signup + email confirmations; add admin user | **Dashboard** (no MCP tool) | user exists |
| 7 | Promote admin to `super_admin` (§3 SQL) | `execute_sql` | row exists |
| 8 | *(Optional)* set `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` — only for the admin PDF-import feature | **Dashboard → Edge Functions → Secrets** | — |

**Client-wiring (outside Supabase — do only if you want the app pointed at the new project):**
- `supabase/config.toml` → `project_id`
- `src/integrations/supabase/client.ts` → `FALLBACK_SUPABASE_URL` + `FALLBACK_SUPABASE_PUBLISHABLE_KEY` (never a secret key)
- `.env` → `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- All three currently point at the dead refs `rmqyyyhkpcspnksarofv` / `atlekmwlqweqxrfbvwie` and must all match the new ref.

The 23 migrations, in order:
```
20260705052505_…  20260705052520_…  20260714071602_…  20260714071701_…
20260714090000_survey_engine        20260714120000_ai_question_creation
20260714150000_analytics_and_hardening              20260717070925_survey_sections_and_batch_reorder
20260717130000_question_bank_crud   20260717130500_seed_question_bank
20260718090000_backfill_iri_telugu  20260718100000_tighten_public_read_rls
20260718113000_submission_integrity_and_survey_limits
20260721094500_response_answer_metadata             20260721101500_family_case_workflow
20260722120000_restrict_family_rpcs 20260722134500_split_assessment_into_modules
20260722151500_digital_use_interview_module         20260722160000_family_access_phone_only
20260722163000_lock_down_legacy_rpc_surface         20260722163500_rls_initplan_and_indexes
20260722164500_survey_list_counts   20260722180000_family_followups
```

---

## 5. Known residues & non-blocking observations (from the audit — none block deployment)

- **`survey_sections` public-read** still keys on `slug IS NOT NULL` (published *or* closed) rather than `status = 'published'` like questions/options — a *closed* survey's section titles stay anon-readable. Pre-existing; tighten later if desired.
- **`reorder_question_bank_items`** is granted to `authenticated` without a matching `REVOKE … FROM PUBLIC` (harmless — it's SECURITY INVOKER, so bank RLS still governs the write).
- **4 analytics functions** (`survey_response_stats`, `survey_response_timeseries`, `question_value_counts`, `survey_period_comparison`) lack `SET search_path` — a hardening inconsistency, not a functional gap. `get_advisors(security)` will likely flag these.
- **`20260722163000_lock_down_legacy_rpc_surface.sql`** references RPCs/views (`patient_portal`, `study_scores`, …) that belong to a *remote prototype* and are not defined in this repo → those statements are **no-ops on a fresh deploy** (idempotent, catalogue-driven). Harmless.
- **Duplicate-named index** `idx_survey_answers_response` appears twice with `IF NOT EXISTS` → the second is a no-op, not a conflict.
- **Legacy tables** carry over unused; drop them only if you want a leaner DB.

---
*Generated from a source-grounded analysis of the repository. No database objects were created and no functions were deployed in producing this plan.*
