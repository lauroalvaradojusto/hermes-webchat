import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isApprovedGoogleEmail } from "@/lib/auth";
import {
  CREDIT_PACKAGES_USD,
  addCredits,
  cleanEnv,
  createAuthedSupabaseClient,
  ensureCreditProfile,
  toCreditSummary,
} from "@/lib/credits";

type ConfirmPayload = {
  provider?: "stripe" | "paypal";
  package_usd?: number;
  proof_id?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ConfirmPayload;
  const provider = body.provider;
  const packageUsd = Number(body.package_usd ?? 0);
  const proofId = cleanEnv(body.proof_id);

  if ((provider !== "stripe" && provider !== "paypal") || !CREDIT_PACKAGES_USD.includes(packageUsd as any)) {
    return NextResponse.json({ ok: false, error: "Invalid provider or package" }, { status: 400 });
  }

  if (!proofId) {
    return NextResponse.json({ ok: false, error: "proof_id is required" }, { status: 400 });
  }

  const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);

  if (userError || !userData.user || !isApprovedGoogleEmail(userData.user.email ?? "")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAuthedSupabaseClient(supabaseUrl, supabaseAnonKey, accessToken);

  const profile = await ensureCreditProfile({
    supabase,
    userId: userData.user.id,
    email: userData.user.email ?? "",
  });

  const updated = await addCredits({
    supabase,
    userId: userData.user.id,
    profile,
    amountUsd: packageUsd,
  });

  return NextResponse.json({
    ok: true,
    provider,
    package_usd: packageUsd,
    proof_id: proofId,
    credits: toCreditSummary(updated),
  });
}
