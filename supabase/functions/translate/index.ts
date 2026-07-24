// Supabase Edge Function: translate
//
// Machine-translates authored survey content English -> Telugu so an admin does
// not have to type every prompt, option and section title twice.
//
// This is an AUTHORING AID, not a publishing decision. The output lands in the
// editable Telugu field and an administrator sees it before anything is
// published — which matters here more than usual: a mistranslated clinical item
// does not merely read badly, it silently measures a different construct, and
// no downstream statistic can detect that. Anything used for scored analysis
// still needs a documented forward-back translation (see the governance
// framework, action A-8). The prompt below is therefore tuned for fidelity
// rather than fluency, and the function refuses to invent content.
//
// Never writes to the database. Requires GEMINI_API_KEY on the project.
// verify_jwt = true: only an authenticated administrator may call it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Bounded so one click cannot turn into an unbounded provider bill. */
const MAX_ITEMS = 120;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `You translate short English survey text into Telugu for a mental-health and well-being questionnaire.

Rules:
- Translate meaning faithfully. Do NOT paraphrase, soften, intensify or explain.
- Keep the clinical register neutral and the reading level simple — respondents include people with limited formal education.
- Preserve the grammatical person and tense ("I have felt..." stays first person).
- Response anchors (e.g. "Some of the time", "Strongly agree") must stay short enough to sit on a button.
- Do NOT add commentary, transliteration, romanisation or the original English.
- If an input is already Telugu, return it unchanged.
- Return EXACTLY one translation per input, in the same order.

Respond with ONLY a JSON object of the exact shape: {"translations": ["...", "..."]}. No markdown fences, no commentary.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const rawTexts = body?.texts;
    if (!Array.isArray(rawTexts) || rawTexts.length === 0) {
      return json({ error: "Provide a non-empty `texts` array." }, 400);
    }
    if (rawTexts.length > MAX_ITEMS) {
      return json({ error: `Too many items in one request (max ${MAX_ITEMS}).` }, 413);
    }

    const texts = rawTexts.map((t: unknown) => (typeof t === "string" ? t.slice(0, MAX_CHARS) : ""));
    if (texts.every((t) => !t.trim())) return json({ translations: texts });

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return json({ error: "Translation is not configured. Set the GEMINI_API_KEY secret on this Supabase project." }, 500);
    }

    // Numbered so the model cannot silently merge or drop a line and still look
    // well-formed — the count check below turns that into a hard failure rather
    // than a quietly misaligned Telugu column.
    const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: numbered }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
    );

    if (resp.status === 429) return json({ error: "Rate limited by the AI provider. Please try again shortly." }, 429);
    if (!resp.ok) {
      console.error("Gemini error", resp.status, await resp.text());
      return json({ error: "The translation service could not respond right now." }, 502);
    }

    const payload = await resp.json();
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let parsed: { translations?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Unparseable translation response", content.slice(0, 500));
      return json({ error: "The translation response could not be understood. Please try again." }, 502);
    }

    const out = Array.isArray(parsed.translations) ? parsed.translations : [];
    if (out.length !== texts.length) {
      // Misalignment is worse than failure: it would write the wrong Telugu
      // onto the wrong question and look completely plausible on screen.
      console.error("Translation count mismatch", { expected: texts.length, got: out.length });
      return json({ error: "The translation came back misaligned. Please try again." }, 502);
    }

    const translations = out.map((t, i) => (typeof t === "string" && t.trim() ? t.trim().slice(0, MAX_CHARS) : texts[i]));
    return json({ translations });
  } catch (e) {
    console.error(e);
    return json({ error: "Unexpected error while translating." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
