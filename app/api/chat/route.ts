import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isApprovedGoogleEmail } from "@/lib/auth";

type FileData = {
  name: string;
  type: string;
  content: string;
};

type Payload = {
  message?: string;
  history?: Array<{ role: string; content: string }>;
  model?: string;
  files?: FileData[];
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

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as Payload;
  const message = (payload.message ?? "").trim();
  const hasFiles = Array.isArray(payload.files) && payload.files.length > 0;

  if (!message && !hasFiles) {
    return NextResponse.json({ ok: false, error: "Message or files are required" }, { status: 400 });
  }

  // Validate file sizes (max 10MB per file, max 3 files)
  if (hasFiles) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_FILES = 3;
    if (payload.files!.length > MAX_FILES) {
      return NextResponse.json({ ok: false, error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }
    for (const file of payload.files!) {
      const size = Math.ceil((file.content.length * 3) / 4); // base64 decode size estimate
      if (size > MAX_FILE_SIZE) {
        return NextResponse.json({ ok: false, error: `File "${file.name}" exceeds 10MB limit` }, { status: 400 });
      }
    }
  }

  const cleanEnv = (value?: string) => (value ?? "").replace(/\\n/g, "").trim();

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

  if (userError || !userData.user || !isApprovedGoogleEmail(email)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const backendUrl = cleanEnv(
    process.env.HERMES_API_URL ||
    process.env.NEXT_PUBLIC_HERMES_API_URL ||
    process.env.VITE_HERMES_API_URL ||
    ""
  ).replace(/\/$/, "");
  const apiKey = cleanEnv(process.env.HERMES_API_KEY || process.env.VITE_HERMES_API_KEY || "");

  if (backendUrl) {
    try {
      // Use analyze-file endpoint when files are attached
      const endpoint = hasFiles
        ? `${backendUrl}/api/v1/chat/analyze-file`
        : `${backendUrl}/api/v1/chat/deepseek`;

      const requestBody = hasFiles
        ? {
            message: message,
            files: payload.files,
            userId: email,
          }
        : {
            message,
            history: payload.history ?? [],
            model: payload.model ?? "",
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
          return NextResponse.json({ ok: true, source: "hermes-backend", ...json });
        } catch {
          return NextResponse.json({ ok: true, source: "hermes-backend", response: raw });
        }
      }
    } catch {
      // fall through to local response
    }
  }

  return NextResponse.json({
    ok: true,
    source: "local-fallback",
    response: fallbackReply(message, payload.history),
  });
}
