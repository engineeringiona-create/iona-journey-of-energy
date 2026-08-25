// Deno edge function — deploy with:
//   supabase functions deploy linkedin-to-announcement
//   supabase secrets set GEMINI_API_KEY=AIza...
//
// Uses Google Gemini instead of Claude (switched to stay on Gemini's free
// tier for this low-volume admin-only task). Calls the Gemini REST API
// directly via fetch rather than the @google/generative-ai npm package —
// that package was being superseded by @google/genai around this model's
// training cutoff, so the plain REST endpoint (stable for a long time
// regardless of which SDK wraps it) is the safer bet in a Deno edge
// function where a wrong import would fail loudly at request time.
//
// The API key lives only in Supabase's secret store and Google's servers;
// it is never sent to or readable from the browser bundle. The admin
// client calls this function via supabase.functions.invoke(...),
// authenticated with the project's anon key (same as every other
// supabase-js call already used across the admin panel).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORIES = ["Proje Geliştirme", "Etkinlik", "Teknoloji", "Saha"];
const MAX_INPUT_CHARS = 8000;
/* gemini-2.5-flash (originally used here) was retired by Google — a
   live probe against this project's own key returned 404 with
   "no longer available to new users... use models/gemini-3.6-flash".
   That's Google's own migration message, not a guess. If this breaks
   again, swap this one constant. */
const GEMINI_MODEL = "gemini-3.6-flash";

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { rawText?: unknown; targetLanguage?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Geçersiz istek gövdesi." }, 400);
  }

  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  const targetLanguage = body.targetLanguage === "en" ? "en" : "tr";
  if (!rawText) {
    return jsonResponse({ error: "rawText boş olamaz." }, 400);
  }
  if (rawText.length > MAX_INPUT_CHARS) {
    return jsonResponse({ error: `Metin çok uzun (maks. ${MAX_INPUT_CHARS} karakter).` }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Sunucu yapılandırması eksik (GEMINI_API_KEY secret'ı ayarlanmamış)." }, 500);
  }

  const languageName = targetLanguage === "en" ? "English" : "Turkish";
  const systemInstruction =
    "You are an editor for IONA Engineering, a biogas/renewable-energy engineering company. " +
    `Given a raw LinkedIn post, produce a clean website announcement in ${languageName}. ` +
    "Write a catchy, professional title fitting the biogas/energy industry. " +
    "Polish the body into clean prose with Markdown **bolding** on key terms and numbers, " +
    "removing LinkedIn-specific artifacts (hashtag spam, 'follow me' CTAs, excess emoji, engagement-bait phrasing). " +
    `Pick exactly one category from this fixed list: ${CATEGORIES.join(", ")}. ` +
    "Extract 3 to 6 short, lowercase keyword tags capturing the key takeaways.";

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  try {
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: rawText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              body_markdown: { type: "STRING" },
              category: { type: "STRING", enum: CATEGORIES },
              tags: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["title", "body_markdown", "category", "tags"],
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      return jsonResponse({ error: "AI dönüştürme başarısız oldu, lütfen tekrar deneyin." }, 502);
    }

    const data = await geminiResponse.json();
    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "PROHIBITED_CONTENT") {
      return jsonResponse({ error: "İçerik AI tarafından reddedildi, lütfen metni gözden geçirin." }, 422);
    }

    const text = candidate.content?.parts?.[0]?.text;
    if (!text) {
      return jsonResponse({ error: "AI yanıtı boş döndü." }, 502);
    }

    const parsed = JSON.parse(text);
    return jsonResponse({ result: parsed }, 200);
  } catch (err) {
    console.error("linkedin-to-announcement error:", err);
    return jsonResponse({ error: "AI dönüştürme başarısız oldu, lütfen tekrar deneyin." }, 502);
  }
});
