import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isApprovedGoogleEmail } from "@/lib/auth";
import {
  CREDIT_PACKAGES_USD,
  cleanEnv,
  createAuthedSupabaseClient,
  ensureCreditProfile,
  toCreditSummary,
} from "@/lib/credits";

function stripeReady() {
  const secret = cleanEnv(process.env.STRIPE_SECRET_KEY);
  const hasAllPrices = CREDIT_PACKAGES_USD.every((amount) => cleanEnv(process.env[`STRIPE_PRICE_ID_${amount}`]).length > 0);
  return Boolean(secret && hasAllPrices);
}

function paypalReady() {
  return Boolean(cleanEnv(process.env.PAYPAL_CLIENT_ID) && cleanEnv(process.env.PAYPAL_CLIENT_SECRET));
}

export async function GET(req: Request) {
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

  try {
    const profile = await ensureCreditProfile({
      supabase,
      userId: userData.user.id,
      email: userData.user.email ?? "",
    });

    return NextResponse.json({
      ok: true,
      credits: toCreditSummary(profile),
      checkout: {
        stripe_ready: stripeReady(),
        paypal_ready: paypalReady(),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to load credits" }, { status: 500 });
  }
}
