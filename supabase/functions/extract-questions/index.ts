// Supabase Edge Function: extract-questions
//
// Takes raw text already extracted client-side from a PDF (see
// src/lib/pdfExtract.ts) and asks an LLM to structure it into survey
// questions. Never writes to the database directly — the client always
// routes the result through a human review screen before anything is
// persisted (see ImportPdfDialog.tsx / lib/surveys.ts#importQuestions).
//
// Requires ONE of these secrets on the Supabase project. They are checked in
// this order, so setting GEMINI_API_KEY alone is enough:
//   GEMINI_API_KEY     -> Google AI Studio / Gemini (gemini-flash-latest)
//   OPENAI_API_KEY     -> OpenAI (gpt-4o-mini)
//   ANTHROPIC_API_KEY  -> Anthropic (claude-haiku-4-5)
// Set with: supabase secrets set GEMINI_API_KEY=...

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUESTION_KINDS = ["multiple_choice", "checkboxes", "likert5", "yes_no", "rating5", "short_text", "long_text", "dropdown"];

const SYSTEM_PROMPT = `You extract survey questions from raw text taken from a PDF questionnaire.
The text may be messy: broken line wraps, page numbers, headers/footers, and numbering artifacts (e.g. "1.", "Q1)", "•").

For every distinct question you find, return an object with:
- "prompt_en": the cleaned question text in English, numbering and bullet artifacts removed, broken line wraps rejoined into a single sentence.
- "prompt_te": the same question in Telugu if the source text contains a Telugu version, otherwise omit this field.
- "kind": one of ${QUESTION_KINDS.join(", ")}.
  - "multiple_choice" if the question lists options and expects exactly one answer.
  - "checkboxes" if the question lists options and explicitly allows multiple answers ("select all that apply", "choose all").
  - "likert5" if the question asks for an agreement/frequency level typically answered on a 5-point scale (e.g. "how often", "to what extent do you agree").
  - "yes_no" if the question is a plain yes/no question.
  - "rating5" if the question explicitly asks for a 1-5 star or numeric rating.
  - "dropdown" if there is a long list of options (more than 6) to choose one from.
  - "short_text" for brief open-ended answers (a word, a number, a name).
  - "long_text" for open-ended answers expecting a paragraph.
- "options": an array of option label strings, in the order they appear, ONLY for multiple_choice / checkboxes / dropdown. Omit or leave empty for other kinds.

Do not invent questions that are not in the source text. Do not invent options that are not shown. If the text contains no questions at all, return an empty array.
Respond with ONLY a JSON object of the exact shape: {"questions": [...]}. No commentary, no markdown fences.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return json({ error: "No text provided" }, 400);
    }

    const trimmed = text.slice(0, 24000); // keep prompts bounded even for large PDFs

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!geminiKey && !openaiKey && !anthropicKey) {
      return json(
        { error: "AI extraction is not configured. Set the GEMINI_API_KEY, OPENAI_API_KEY or ANTHROPIC_API_KEY secret on this Supabase project." },
        500,
      );
    }

    let content: string;

    if (geminiKey) {
      // responseMimeType pins JSON output — the same guarantee OpenAI's
      // response_format gives. Without it Gemini wraps the object in prose or
      // markdown fences and the parse below rejects a perfectly good extraction.
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: trimmed }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          }),
        },
      );
      if (resp.status === 429) return json({ error: "Rate limited by the AI provider. Please try again shortly." }, 429);
      if (!resp.ok) {
        console.error("Gemini error", resp.status, await resp.text());
        return json({ error: "The AI service could not process this PDF right now." }, 502);
      }
      const payload = await resp.json();
      content = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    } else if (openaiKey) {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: trimmed },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });
      if (resp.status === 429) return json({ error: "Rate limited by the AI provider. Please try again shortly." }, 429);
      if (!resp.ok) {
        console.error("OpenAI error", resp.status, await resp.text());
        return json({ error: "The AI service could not process this PDF right now." }, 502);
      }
      const payload = await resp.json();
      content = payload.choices?.[0]?.message?.content ?? "{}";
    } else {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: trimmed }],
        }),
      });
      if (resp.status === 429) return json({ error: "Rate limited by the AI provider. Please try again shortly." }, 429);
      if (!resp.ok) {
        console.error("Anthropic error", resp.status, await resp.text());
        return json({ error: "The AI service could not process this PDF right now." }, 502);
      }
      const payload = await resp.json();
      content = payload.content?.[0]?.text ?? "{}";
    }

    let parsed: { questions?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Could not parse AI response", content);
      return json({ error: "The AI response could not be understood. Please try again." }, 502);
    }

    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const cleaned = questions
      .map((q) => sanitizeQuestion(q))
      .filter((q): q is NonNullable<ReturnType<typeof sanitizeQuestion>> => q !== null);

    return json({ questions: cleaned });
  } catch (e) {
    console.error(e);
    return json({ error: "Unexpected error while extracting questions." }, 500);
  }
});

function sanitizeQuestion(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const prompt_en = typeof r.prompt_en === "string" ? r.prompt_en.trim() : "";
  if (!prompt_en) return null;
  const kind = QUESTION_KINDS.includes(String(r.kind)) ? String(r.kind) : "short_text";
  const prompt_te = typeof r.prompt_te === "string" && r.prompt_te.trim() ? r.prompt_te.trim() : undefined;
  const options = Array.isArray(r.options) ? r.options.filter((o) => typeof o === "string" && o.trim()).map((o) => String(o).trim()) : [];
  return { prompt_en, prompt_te, kind, options };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
