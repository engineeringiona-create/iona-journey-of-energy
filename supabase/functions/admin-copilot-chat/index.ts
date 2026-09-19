// Deno edge function — deploy with:
//   supabase functions deploy admin-copilot-chat
// Reuses the GEMINI_API_KEY secret already set for linkedin-to-announcement.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected into every
// Supabase edge function by the platform — no extra secret needed for the
// list_recent_leads tool to read contact_submissions with elevated access
// (the admin panel's own login is a separate, simpler client-side gate —
// see src/components/Admin/auth.js — so this function, like every other
// admin edge function in this project, is reachable by anyone holding the
// public anon key; that's a pre-existing property of this project's admin
// auth model, not something new introduced here).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-3.6-flash";
const MAX_TOOL_ITERATIONS = 4;

/* Same coefficients as src/lib/biogasCalculator.js — kept in sync by hand
   (this is a small, stable, hand-verified constant table, not something
   worth a build step to share across a Deno function and a browser
   bundle) so the copilot's yield answers never disagree with the public
   calculator's numbers. */
const WASTE_PROFILES: Record<string, { label: string; yieldM3PerTon: number; ch4: number }> = {
  cattle: { label: "Büyükbaş Hayvan Gübresi", yieldM3PerTon: 25, ch4: 0.6 },
  poultry: { label: "Kanatlı Gübresi", yieldM3PerTon: 45, ch4: 0.6 },
  silage: { label: "Tarımsal / Mısır Silajı", yieldM3PerTon: 190, ch4: 0.52 },
  industrial: { label: "Organik Endüstriyel Atık", yieldM3PerTon: 100, ch4: 0.55 },
};
const CH4_LHV_KWH_PER_M3 = 9.94;
const CHP_ELECTRICAL_EFFICIENCY = 0.4;
const CHP_THERMAL_EFFICIENCY = 0.45;
const ANNUAL_AVAILABILITY = 0.92;
const GRID_CO2_FACTOR_TON_PER_MWH = 0.45;

const ANNOUNCEMENT_CATEGORIES = ["Proje Geliştirme", "Etkinlik", "Teknoloji", "Saha"];

const SYSTEM_INSTRUCTION =
  "You are the IONA Biogas Engineering & Operations Copilot, an internal assistant for IONA Engineering's " +
  "admin team on their biogas plant company website. You help manage website announcements, analyze " +
  "incoming leads/quote requests, draft technical proposal responses, and answer biogas engineering " +
  "estimation questions. Always reply in Turkish unless the admin writes in another language. " +
  "When asked to create or draft a website announcement (from a raw pasted post, a URL, or a plain " +
  "description), you MUST call propose_announcement — never just describe the draft in prose, the admin " +
  "needs the structured card to approve it with one click. " +
  "When asked about leads, quote requests, or to draft a response to a specific person, call " +
  "list_recent_leads first to see the real data before writing anything. " +
  "When asked about plant capacity, yield, kWe/MWh estimates, or 'how much power would X tons produce', " +
  "call biogas_yield_estimate instead of computing it yourself — the tool uses the site's own published " +
  "coefficients, so a hand-computed answer could disagree with the public calculator. " +
  "Be concise, technical where appropriate, and professional — you're a colleague, not a marketing bot.";

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "propose_announcement",
        description:
          "Prepare a structured draft website announcement for the admin to review and approve with one click. " +
          "Call this whenever asked to turn a post/URL/description into an announcement.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Catchy, professional Turkish title." },
            body_markdown: {
              type: "STRING",
              description: "Clean announcement body with Markdown **bolding** on key terms/numbers.",
            },
            category: { type: "STRING", enum: ANNOUNCEMENT_CATEGORIES },
            tags: { type: "ARRAY", items: { type: "STRING" }, description: "3-6 short lowercase keyword tags." },
          },
          required: ["title", "body_markdown", "category", "tags"],
        },
      },
      {
        name: "list_recent_leads",
        description:
          "Fetch the most recent contact form / quote request submissions from the website, newest first.",
        parameters: {
          type: "OBJECT",
          properties: {
            limit: { type: "INTEGER", description: "Max rows to return, default 10, max 25." },
          },
        },
      },
      {
        name: "biogas_yield_estimate",
        description:
          "Estimate installed electrical/thermal capacity and annual CO2 reduction for a biogas plant, " +
          "given a waste type and daily tonnage, using IONA's own published estimation coefficients.",
        parameters: {
          type: "OBJECT",
          properties: {
            waste_type: {
              type: "STRING",
              enum: Object.keys(WASTE_PROFILES),
              description:
                "cattle = Büyükbaş Hayvan Gübresi, poultry = Kanatlı Gübresi, silage = Tarımsal/Mısır Silajı, " +
                "industrial = Organik Endüstriyel Atık",
            },
            tons_per_day: { type: "NUMBER", description: "Daily feedstock tonnage, 10-500." },
          },
          required: ["waste_type", "tons_per_day"],
        },
      },
    ],
  },
];

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function computeBiogasYield(wasteType: string, tonsPerDay: number) {
  const profile = WASTE_PROFILES[wasteType];
  if (!profile) return { error: `Unknown waste_type "${wasteType}"` };
  const clampedTons = Math.min(500, Math.max(10, tonsPerDay));
  const dailyBiogasM3 = clampedTons * profile.yieldM3PerTon;
  const dailyEnergyKWh = dailyBiogasM3 * profile.ch4 * CH4_LHV_KWH_PER_M3;
  const installedElectricalKWe = (dailyEnergyKWh * CHP_ELECTRICAL_EFFICIENCY) / 24;
  const installedThermalKWth = (dailyEnergyKWh * CHP_THERMAL_EFFICIENCY) / 24;
  const annualElectricityMWh = (installedElectricalKWe * 8760 * ANNUAL_AVAILABILITY) / 1000;
  const annualCO2AvoidedTon = annualElectricityMWh * GRID_CO2_FACTOR_TON_PER_MWH;
  return {
    waste_type_label: profile.label,
    tons_per_day: clampedTons,
    installed_electrical_kwe: Math.round(installedElectricalKWe),
    installed_thermal_kwth: Math.round(installedThermalKWth),
    annual_electricity_mwh: Math.round(annualElectricityMWh),
    annual_co2_avoided_ton: Math.round(annualCO2AvoidedTon),
    note: "Yaklaşık tahmin, sektör ortalaması katsayılarına dayanır.",
  };
}

async function listRecentLeads(supabaseUrl: string, serviceRoleKey: string, limit: number) {
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const boundedLimit = Math.min(25, Math.max(1, limit || 10));
  /* select('*') on purpose, not a named column list — the real deployed
     table doesn't match supabase/schema.sql (confirmed live: no `subject`
     column exists, even though the file declares one). InboxDrawer.jsx
     already avoids this same drift the same way. */
  const { data, error } = await admin
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(boundedLimit);
  if (error) return { error: error.message };
  return { leads: data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Geçersiz istek gövdesi." }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return jsonResponse({ error: "messages boş olamaz." }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Sunucu yapılandırması eksik (GEMINI_API_KEY secret'ı ayarlanmamış)." }, 500);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  /* `messages` from the client is already in Gemini `contents` shape —
     [{role: "user"|"model", parts: [{text}]}] — the client just replays
     its own visible chat history back each turn (this function is
     stateless, same pattern as linkedin-to-announcement). */
  const contents = [...messages];
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          tools: TOOLS,
        }),
      });

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.error("Gemini API error:", geminiResponse.status, errText);
        return jsonResponse({ error: "AI yanıt veremedi, lütfen tekrar deneyin." }, 502);
      }

      const data = await geminiResponse.json();
      const candidate = data.candidates?.[0];
      if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "PROHIBITED_CONTENT") {
        return jsonResponse({ error: "İçerik AI tarafından reddedildi." }, 422);
      }

      const parts = candidate.content?.parts || [];
      const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);

      if (!functionCallPart) {
        const text = parts.find((p: { text?: string }) => typeof p.text === "string")?.text || "";
        return jsonResponse({ type: "message", text }, 200);
      }

      const { name, args } = functionCallPart.functionCall;
      // This model generation requires the opaque thought_signature from a
      // functionCall part to be echoed back verbatim on replay, or the next
      // request 400s ("Function call is missing a thought_signature") —
      // confirmed against the live API, not documentation (this model is
      // newer than this skill's cached docs). Carrying it through here,
      // same as Claude's extended-thinking block replay rule.
      const thoughtSignature = functionCallPart.thoughtSignature;

      // propose_announcement is a client-confirmed action, not something
      // this function executes — short-circuit and hand the draft straight
      // back to the UI instead of looping Gemini again.
      if (name === "propose_announcement") {
        return jsonResponse({ type: "proposal", proposal: args }, 200);
      }

      let toolResult: unknown;
      if (name === "list_recent_leads") {
        if (!supabaseUrl || !serviceRoleKey) {
          toolResult = { error: "Sunucu yapılandırması eksik (service role key)." };
        } else {
          toolResult = await listRecentLeads(supabaseUrl, serviceRoleKey, args?.limit);
        }
      } else if (name === "biogas_yield_estimate") {
        toolResult = computeBiogasYield(args?.waste_type, Number(args?.tons_per_day));
      } else {
        toolResult = { error: `Unknown tool "${name}"` };
      }

      contents.push({
        role: "model",
        parts: [{ functionCall: { name, args }, ...(thoughtSignature ? { thoughtSignature } : {}) }],
      });
      // "function" role was rejected by this model generation ("Role
      // 'function' is not supported") — the accepted role for a
      // functionResponse turn is "user", confirmed live.
      contents.push({ role: "user", parts: [{ functionResponse: { name, response: toolResult } }] });
    }

    return jsonResponse({ type: "message", text: "İşlem çok fazla adım gerektirdi, lütfen sorunuzu daraltın." }, 200);
  } catch (err) {
    console.error("admin-copilot-chat error:", err);
    return jsonResponse({ error: "Bir hata oluştu, lütfen tekrar deneyin." }, 502);
  }
});
