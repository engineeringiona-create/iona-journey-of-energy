// Deno edge function — deploy with:
//   supabase functions deploy linkedin-to-announcement
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The API key lives only in Supabase's secret store and Anthropic's
// servers; it is never sent to or readable from the browser bundle. The
// admin client calls this function via supabase.functions.invoke(...),
// authenticated with the project's anon key (same as every other
// supabase-js call already used across the admin panel).
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORIES = ["Proje Geliştirme", "Etkinlik", "Teknoloji", "Saha"];
const MAX_INPUT_CHARS = 8000;

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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Sunucu yapılandırması eksik (ANTHROPIC_API_KEY secret'ı ayarlanmamış)." }, 500);
  }

  const client = new Anthropic({ apiKey });
  const languageName = targetLanguage === "en" ? "English" : "Turkish";

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      system:
        "You are an editor for IONA Engineering, a biogas/renewable-energy engineering company. " +
        `Given a raw LinkedIn post, produce a clean website announcement in ${languageName}. ` +
        "Write a catchy, professional title fitting the biogas/energy industry. " +
        "Polish the body into clean prose with Markdown **bolding** on key terms and numbers, " +
        "removing LinkedIn-specific artifacts (hashtag spam, 'follow me' CTAs, excess emoji, engagement-bait phrasing). " +
        `Pick exactly one category from this fixed list: ${CATEGORIES.join(", ")}. ` +
        "Extract 3 to 6 short, lowercase keyword tags capturing the key takeaways.",
      messages: [{ role: "user", content: rawText }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              body_markdown: { type: "string" },
              category: { type: "string", enum: CATEGORIES },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["title", "body_markdown", "category", "tags"],
            additionalProperties: false,
          },
        },
      },
    });

    if (response.stop_reason === "refusal") {
      return jsonResponse({ error: "İçerik AI tarafından reddedildi, lütfen metni gözden geçirin." }, 422);
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return jsonResponse({ error: "AI yanıtı boş döndü." }, 502);
    }

    const parsed = JSON.parse(textBlock.text);
    return jsonResponse({ result: parsed }, 200);
  } catch (err) {
    console.error("linkedin-to-announcement error:", err);
    return jsonResponse({ error: "AI dönüştürme başarısız oldu, lütfen tekrar deneyin." }, 502);
  }
});
