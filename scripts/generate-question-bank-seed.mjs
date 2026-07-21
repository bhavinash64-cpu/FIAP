/**
 * Generates the Question Bank seed migration from src/lib/instruments.ts.
 *
 * The static file is the source of truth for the seed because it is exactly
 * what the console renders today — seeding from it means the bank's content
 * does not change, it only becomes editable. (The legacy `instrument_items`
 * table holds the same 8 instruments but drops the bilingual scale labels,
 * which is why it is not used as the source.)
 *
 * Output shape: one JSON document + a single chained-CTE INSERT that expands
 * it. The obvious alternative — 240 literal INSERTs with hardcoded UUIDs —
 * came out at 138KB, ~80% of which was UUIDs and repeated column lists
 * restating ~25KB of actual question text. Letting Postgres generate the keys
 * and join items to options through the JSON nesting keeps the migration close
 * to the size of its content.
 *
 * Run:  node scripts/generate-question-bank-seed.mjs
 */
import esbuild from "esbuild";
import { writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT_SQL = "supabase/migrations/20260717130500_seed_question_bank.sql";
const TMP_JS = "scripts/.instruments.bundle.mjs";

// instruments.ts imports the browser Supabase client at module scope, which
// throws without import.meta.env. Stub the runtime imports; the type-only
// import of @/lib/surveys is erased by esbuild on its own.
const stubPlugin = {
  name: "stub-runtime-deps",
  setup(build) {
    build.onResolve({ filter: /^@\/(integrations\/supabase\/client|lib\/audit)$/ }, (a) => ({
      path: a.path,
      namespace: "stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export const supabase = {}; export const logAudit = async () => {};",
      loader: "js",
    }));
  },
};

await esbuild.build({
  entryPoints: ["src/lib/instruments.ts"],
  outfile: TMP_JS,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
  plugins: [stubPlugin],
});

const { INSTRUMENTS } = await import(pathToFileURL(TMP_JS).href);
rmSync(TMP_JS, { force: true });

// Mirrors importInstruments() in src/lib/instruments.ts — only these kinds read
// their options; yes_no/rating5/likert5/text render their own controls.
const KINDS_WITH_OPTIONS = new Set(["multiple_choice", "checkboxes", "dropdown"]);

let totalItems = 0;
let totalOptions = 0;

// Short keys, and absent rather than null for missing translations: this
// document is transmitted verbatim inside the migration.
const doc = INSTRUMENTS.map((inst, instIndex) => {
  const items = inst.items.map((item) => {
    const kind = item.kind ?? inst.defaultKind ?? "multiple_choice";
    const scale = item.scale ?? inst.defaultScale;
    const options = KINDS_WITH_OPTIONS.has(kind) && scale?.length ? scale : [];
    totalItems++;
    totalOptions += options.length;

    const out = { k: kind, en: item.en };
    if (item.te) out.te = item.te;
    if (options.length) {
      out.o = options.map((p) => {
        const opt = { en: p.en };
        if (p.te) opt.te = p.te;
        return opt;
      });
    }
    return out;
  });

  const out = { c: inst.key, n: inst.name, i: instIndex, items };
  if (inst.nameTe) out.nte = inst.nameTe;
  if (inst.blurb) out.b = inst.blurb;
  if (inst.source) out.s = inst.source;
  return out;
});

const json = JSON.stringify(doc).replace(/'/g, "''");

const sql = `-- =========================================================
-- Seed: the 8 built-in research instruments and their ${totalItems} questions.
--
-- GENERATED FILE — do not hand-edit.
-- Regenerate with: node scripts/generate-question-bank-seed.mjs
--
-- Content is copied verbatim from src/lib/instruments.ts, the static constant
-- the Question Bank rendered before it became editable, so this seed changes
-- nothing a user can see.
--
-- is_builtin marks these rows as reproductions of published instruments.
-- source_snapshot freezes each item's original wording/kind/options so the UI
-- can flag "Modified from source" and offer a one-click revert; it is derived
-- from the rows inserted here rather than restated, so it cannot disagree
-- with them.
--
-- Idempotent: ON CONFLICT on the instrument code short-circuits the whole
-- chain, because items are only inserted for instruments this run created.
-- =========================================================

WITH payload AS (
  SELECT '${json}'::jsonb AS doc
),
-- Instruments. A code that already exists yields no row here, and therefore no
-- items and no options either — that is what makes re-running safe.
inst AS (
  INSERT INTO public.question_bank_instruments
    (code, name_en, name_te, blurb_en, source, order_index, is_builtin, source_item_count)
  SELECT e->>'c', e->>'n', e->>'nte', e->>'b', e->>'s',
         (e->>'i')::int, true, jsonb_array_length(e->'items')
    FROM payload, jsonb_array_elements(payload.doc) AS e
  ON CONFLICT (code) DO NOTHING
  RETURNING id, code
),
-- Items. WITH ORDINALITY preserves the authored order of the JSON array as
-- order_index, so the bank lists items exactly as the static file did.
itm AS (
  INSERT INTO public.question_bank_items
    (instrument_id, order_index, kind, prompt_en, prompt_te, required, is_builtin)
  SELECT inst.id, (it.ord - 1)::int, (it.val->>'k')::public.question_kind,
         it.val->>'en', it.val->>'te', true, true
    FROM payload,
         jsonb_array_elements(payload.doc) AS e
         JOIN inst ON inst.code = e->>'c'
         CROSS JOIN LATERAL jsonb_array_elements(e->'items') WITH ORDINALITY AS it(val, ord)
  RETURNING id, instrument_id, order_index
),
-- Options, rejoined to their item by (instrument, order_index) — the pair is
-- unique within a single seed run.
opt AS (
  INSERT INTO public.question_bank_item_options (item_id, order_index, label_en, label_te)
  SELECT itm.id, (o.ord - 1)::int, o.val->>'en', o.val->>'te'
    FROM payload,
         jsonb_array_elements(payload.doc) AS e
         JOIN inst ON inst.code = e->>'c'
         CROSS JOIN LATERAL jsonb_array_elements(e->'items') WITH ORDINALITY AS it(val, ord)
         JOIN itm ON itm.instrument_id = inst.id AND itm.order_index = (it.ord - 1)
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(it.val->'o', '[]'::jsonb)) WITH ORDINALITY AS o(val, ord)
  RETURNING 1
)
SELECT count(*) AS options_inserted FROM opt;

-- Freeze the published form of every seeded item, built from the rows above so
-- the snapshot cannot drift from what it describes. Guarded on IS NULL: a
-- re-run must never re-freeze an item the user has since edited.
UPDATE public.question_bank_items i
   SET source_snapshot = jsonb_build_object(
         'prompt_en', i.prompt_en,
         'prompt_te', i.prompt_te,
         'kind',      i.kind::text,
         'options',   COALESCE((
           SELECT jsonb_agg(jsonb_build_object('label_en', o.label_en, 'label_te', o.label_te) ORDER BY o.order_index)
             FROM public.question_bank_item_options o
            WHERE o.item_id = i.id
         ), '[]'::jsonb)
       )
 WHERE i.is_builtin AND i.source_snapshot IS NULL;
`;

writeFileSync(OUT_SQL, sql, "utf8");
console.log(`wrote ${OUT_SQL}  (${(sql.length / 1024).toFixed(1)}KB)`);
console.log(`  instruments: ${INSTRUMENTS.length}`);
console.log(`  items:       ${totalItems}`);
console.log(`  options:     ${totalOptions}`);
