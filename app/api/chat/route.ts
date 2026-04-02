import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isApprovedGoogleEmail } from "@/lib/auth";
import {
  CHAT_MESSAGE_COST_USD,
  createAuthedSupabaseClient,
  ensureCreditProfile,
  consumeChatCredit,
  toCreditSummary,
  cleanEnv,
} from "@/lib/credits";

type FileData = {
  name: string;
  type: string;
  content: string;
};

type Payload = {
  message?: string;
  history?: Array<{ role: string; content: string }>;
  model?: string;
  search?: boolean;
  files?: FileData[];
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function fallbackReply(message: string, history: Payload["history"] = []) {
  const lower = message.toLowerCase();
  if (lower.includes("ayuda") || lower.includes("help")) {
    return "Puedo ayudarte con prompts, comandos, resúmenes, archivos y flujos de Hermes.";
  }
  if (lower.includes("resumen")) {
    return "Resumen: tomo tu mensaje y preparo una respuesta clara para la interfaz de Hermes.";
  }
  if (lower.includes("deploy") || lower.includes("port")) {
    return "Listo. La interfaz corre en Next.js y puede servir en el puerto 3010.";
  }
  const last = history.at(-1)?.content ?? "";
  return `Hermes recibió: ${message}. ${last ? `Contexto previo: ${last.slice(0, 80)}.` : ""}`.trim();
}

const LEGAL_SYSTEM_PROMPT = [
  "[LEGAL_MODE - ACTIVE]",
  "Eres un asistente jurídico especializado en derecho penal mexicano.",
  "Tienes indexed en tu memoria vectorial dos códigos penales:",
  "  A) Código Penal del Estado de México (EDOMEX) — índices: LEGAL_INDEX_*",
  "  B) Código Penal para el Distrito Federal / Ciudad de México (CDMX) — índices: CDMX_LEGAL_INDEX_*",
  "Cuando respondas consultas legales, sigue estas reglas:",
  "1. Detecta si la consulta refiere a EDOMEX o CDMX y prioriza los índices correspondientes.",
  "2. Cita artículos específicos con formato: Artículo XXX, Libro X, Título X, Capítulo X, Jurisdicción.",
  "3. Si un artículo está derogado, indícalo explícitamente.",
  "4. No inventes artículos ni supongas contenido legal. Si no encuentras el artículo, indica que no está en la base.",
  "5. Estructura respuestas legales con: a) Jurisdicción, b) Artículo aplicable, c) Texto legal relevante, d) Interpretación.",
  "6. Ignora chunks de memoria no-legales (GENERAL, TECH, etc.) cuando respondas consultas jurídicas.",
  "[/LEGAL_MODE]",
].join("\n");

function isLegalQuery(message: string): boolean {
  const m = message.toLowerCase();
  const triggers = [
    "artículo", "articulo", "codigo penal", "código penal", "pena", "delito",
    "delitos", "prisión", "prision", "delincuente", "delito", "hurto", "robo",
    "fraude", "homicidio", "asesinato", "lesiones", "secuestro", "violación",
    "violacion", "abuso", "allanamiento", "denuncia", "querella", "juicio",
    "sentencia", "proceso penal", "juez", "fiscalía", "fiscalia", "ministerio público",
    "amparo", "garantía", "garantia", "libertad", "caución", "caucion",
    "libro", "título", "titulo", "capítulo", "capitulo", "derogado",
    "reforma", "jurídico", "juridico", "legal", "ley", "norma", "normativo",
    "sanción", "sancion", "culpable", "inocente", "imputación", "imputacion",
    "ciudad de méxico", "cdmx", "distrito federal", "edomex", "estado de méxico",
  ];
  return triggers.some((term) => m.includes(term));
}

function shouldAutoSearch(message: string) {
  const m = message.toLowerCase();
  const triggers = [
    "latest", "today", "current", "news", "breaking", "update", "recent", "now",
    "price", "stock", "market", "weather", "release", "version", "who won", "results",
    "hoy", "actual", "actualizado", "último", "ultima", "última", "noticia", "noticias",
    "precio", "cotización", "cotizacion", "tendencia", "fuente", "source", "link", "cite",
  ];
  if (triggers.some((term) => m.includes(term))) return true;
  if (/\b20\d{2}\b/.test(m)) return true;
  return false;
}

async function webSearch(query: string, braveApiKey: string): Promise<SearchResult[]> {
  if (!braveApiKey) {
    throw new Error("BRAVE_API_KEY missing");
  }

  const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
  const braveResp = await fetch(braveUrl, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": braveApiKey,
    },
  });

  if (!braveResp.ok) {
    throw new Error(`Brave API error ${braveResp.status}`);
  }

  const data = await braveResp.json();
  return (data?.web?.results ?? [])
    .slice(0, 5)
    .map((item: any) => ({
      title: String(item?.title ?? "").trim(),
      url: String(item?.url ?? "").trim(),
      snippet: String(item?.description ?? "").trim(),
    }))
    .filter((item: SearchResult) => item.title && item.url);
}

function buildWebContext(query: string, results: SearchResult[]) {
  if (!results.length) return "";
  const now = new Date().toISOString();
  const refs = results
    .map((item, idx) => `[${idx + 1}] ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet}`)
    .join("\n\n");

  return [
    "[WEB_SEARCH_CONTEXT]",
    `Query: ${query}`,
    `Timestamp: ${now}`,
    "Use this context for fresh facts. Cite source URLs inline when relevant.",
    refs,
    "[/WEB_SEARCH_CONTEXT]",
  ].join("\n");
}

function creditsPayload(profile: Awaited<ReturnType<typeof ensureCreditProfile>>) {
  return {
    ...toCreditSummary(profile),
    charged_this_request_usd: 0,
  };
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as Payload;
  const message = (payload.message ?? "").trim();
  const hasFiles = Array.isArray(payload.files) && payload.files.length > 0;

  if (!message && !hasFiles) {
    return NextResponse.json({ ok: false, error: "Message or files are required" }, { status: 400 });
  }

  if (hasFiles) {
    const maxFileSize = 10 * 1024 * 1024;
    const maxFiles = 3;
    if (payload.files!.length > maxFiles) {
      return NextResponse.json({ ok: false, error: `Maximum ${maxFiles} files allowed` }, { status: 400 });
    }
    for (const file of payload.files!) {
      const size = Math.ceil((file.content.length * 3) / 4);
      if (size > maxFileSize) {
        return NextResponse.json({ ok: false, error: `File "${file.name}" exceeds 10MB limit` }, { status: 400 });
      }
    }
  }

  const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const email = userData.user?.email ?? "";
  const userId = userData.user?.id ?? "";

  if (userError || !userData.user || !isApprovedGoogleEmail(email)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const userSupabase = createAuthedSupabaseClient(supabaseUrl, supabaseAnonKey, accessToken);

  let profile;
  try {
    profile = await ensureCreditProfile({
      supabase: userSupabase,
      userId,
      email,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to load credits profile" }, { status: 500 });
  }

  if (!profile.unlimited_credits && profile.credits < CHAT_MESSAGE_COST_USD) {
    return NextResponse.json(
      {
        ok: false,
        error: "Insufficient credits. Purchase a package to continue.",
        credits: creditsPayload(profile),
      },
      { status: 402 },
    );
  }

  const backendUrl = cleanEnv(
    process.env.HERMES_API_URL ||
      process.env.NEXT_PUBLIC_HERMES_API_URL ||
      process.env.VITE_HERMES_API_URL ||
      "",
  ).replace(/\/$/, "");
  const apiKey = cleanEnv(process.env.HERMES_API_KEY || process.env.VITE_HERMES_API_KEY || "");
  const braveApiKey = cleanEnv(process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || "");

  const legalModeEnabled = cleanEnv(process.env.LEGAL_MODE_ENABLED || "true").toLowerCase() === "true";
  const isLegal = legalModeEnabled && isLegalQuery(message);

  let messageForModel = message;
  let searchResults: SearchResult[] = [];
  let webSearchError: string | null = null;
  const webSearchEnabled = cleanEnv(process.env.WEB_SEARCH_ENABLED || "true").toLowerCase() === "true";

  // Inject legal system prompt for legal queries
  if (isLegal) {
    messageForModel = `${LEGAL_SYSTEM_PROMPT}\n\nConsulta del usuario: ${message}`;
  }
  const shouldSearch = webSearchEnabled && !hasFiles && (payload.search === true || shouldAutoSearch(message));

  if (!webSearchEnabled) {
    webSearchError = "disabled_by_config";
  }

  if (shouldSearch && message) {
    try {
      searchResults = await webSearch(message, braveApiKey);
      const webContext = buildWebContext(message, searchResults);
      if (webContext) {
        messageForModel = `${message}\n\n${webContext}`;
      }
    } catch (error) {
      webSearchError = error instanceof Error ? error.message : "web search failed";
    }
  }

  const buildResponse = async (base: Record<string, unknown>) => {
    let finalProfile = profile;
    let chargeError: string | null = null;

    if (!profile.unlimited_credits) {
      try {
        finalProfile = await consumeChatCredit({
          supabase: userSupabase,
          userId,
          profile,
        });
      } catch {
        chargeError = "Credit consumption failed";
      }
    }

    return {
      ...base,
      web_search: {
        requested: shouldSearch,
        used: searchResults.length > 0,
        provider: "brave",
        error: webSearchError,
        sources: searchResults.slice(0, 5),
      },
      legal_mode: {
        enabled: legalModeEnabled,
        detected: isLegal,
      },
      credits: {
        ...toCreditSummary(finalProfile),
        charged_this_request_usd: profile.unlimited_credits ? 0 : CHAT_MESSAGE_COST_USD,
        charge_error: chargeError,
      },
    };
  };

  if (backendUrl) {
    try {
      const endpoint = hasFiles ? `${backendUrl}/api/v1/chat/analyze-file` : `${backendUrl}/api/v1/chat/deepseek`;

      const requestBody = hasFiles
        ? {
            message: messageForModel,
            files: payload.files,
            userId: email,
          }
        : {
            message: messageForModel,
            history: payload.history ?? [],
            model: payload.model ?? "",
            search: shouldSearch,
          };

      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-API-Key": apiKey } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      const raw = await upstream.text();

      if (upstream.ok) {
        try {
          const json = JSON.parse(raw);
          return NextResponse.json(
            await buildResponse({
              ok: true,
              source: "hermes-backend",
              ...json,
            }),
          );
        } catch {
          return NextResponse.json(
            await buildResponse({
              ok: true,
              source: "hermes-backend",
              response: raw,
            }),
          );
        }
      }
    } catch {
      // fall through to local fallback
    }
  }

  return NextResponse.json(
    await buildResponse({
      ok: true,
      source: "local-fallback",
      response: fallbackReply(messageForModel, payload.history),
    }),
  );
}
