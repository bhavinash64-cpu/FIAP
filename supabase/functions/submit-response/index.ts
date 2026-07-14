// Supabase Edge Function: submit-response
//
// The single write path for anonymous public survey submissions. Direct
// anon INSERT on survey_responses/survey_answers is revoked (see
// migrations/20260714150000_analytics_and_hardening.sql) specifically so
// every public submission passes through here, where it can be rate-limited
// by a hashed IP fingerprint before it ever touches the database.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_SECONDS_BETWEEN_SUBMISSIONS = 5 * 60; // one submission per IP per survey per 5 minutes
const MAX_SUBMISSIONS_PER_DAY = 20; // hard ceiling per IP per survey per day

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { survey_id, language, answers, started_at } = await req.json();
    if (!survey_id || typeof survey_id !== "string") return json({ error: "Missing survey_id" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: survey, error: sErr } = await supabase.from("surveys").select("id, status").eq("id", survey_id).maybeSingle();
    if (sErr) throw sErr;
    if (!survey) return json({ error: "Survey not found" }, 404);
    if (survey.status !== "published") return json({ error: "This survey is not currently accepting responses." }, 403);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
    const ipHash = await sha256(ip);
    const now = new Date();

    const { count: recentCount } = await supabase
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", survey_id)
      .eq("ip_hash", ipHash)
      .gte("submitted_at", new Date(now.getTime() - MIN_SECONDS_BETWEEN_SUBMISSIONS * 1000).toISOString());
    if ((recentCount ?? 0) > 0) {
      return json({ error: "You've already submitted this survey recently. Please try again in a few minutes." }, 429);
    }

    const { count: dailyCount } = await supabase
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", survey_id)
      .eq("ip_hash", ipHash)
      .gte("submitted_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    if ((dailyCount ?? 0) >= MAX_SUBMISSIONS_PER_DAY) {
      return json({ error: "Too many submissions from this connection today. Please try again tomorrow." }, 429);
    }

    const { data: response, error: rErr } = await supabase
      .from("survey_responses")
      .insert({
        survey_id,
        language: typeof language === "string" ? language : "en",
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        ip_hash: ipHash,
        started_at: typeof started_at === "string" ? started_at : null,
      })
      .select("id")
      .single();
    if (rErr) throw rErr;

    const rows = Object.entries(answers ?? {})
      .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([question_id, value]) => {
        if (Array.isArray(value)) return { response_id: response.id, question_id, value_json: value };
        if (typeof value === "number") return { response_id: response.id, question_id, value_int: value };
        return { response_id: response.id, question_id, value_text: String(value) };
      });

    if (rows.length) {
      const { error: aErr } = await supabase.from("survey_answers").insert(rows);
      if (aErr) throw aErr;
    }

    return json({ id: response.id });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong while submitting. Please try again." }, 500);
  }
});

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
