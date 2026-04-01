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

type Provider = "stripe" | "paypal";

function isSupportedAmount(amount: number) {
  return CREDIT_PACKAGES_USD.includes(amount as (typeof CREDIT_PACKAGES_USD)[number]);
}

function getAppUrl(req: Request) {
  return (
    cleanEnv(process.env.NEXT_PUBLIC_APP_URL) ||
    req.headers.get("origin") ||
    "https://hermes-webchat.vercel.app"
  ).replace(/\/$/, "");
}

async function createStripeCheckout(params: {
  amountUsd: number;
  userId: string;
  email: string;
  req: Request;
}) {
  const { amountUsd, userId, email, req } = params;
  const stripeSecret = cleanEnv(process.env.STRIPE_SECRET_KEY);
  const priceId = cleanEnv(process.env[`STRIPE_PRICE_ID_${amountUsd}`]);

  if (!stripeSecret || !priceId) {
    return {
      ok: false,
      missing_env: [
        !stripeSecret ? "STRIPE_SECRET_KEY" : null,
        !priceId ? `STRIPE_PRICE_ID_${amountUsd}` : null,
      ].filter(Boolean),
    } as const;
  }

  const appUrl = getAppUrl(req);
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${appUrl}/payment-success?provider=stripe&session_id={CHECKOUT_SESSION_ID}&pack=${amountUsd}`);
  form.set("cancel_url", `${appUrl}/?checkout=cancelled`);
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("client_reference_id", userId);
  form.set("customer_email", email);
  form.set("metadata[user_id]", userId);
  form.set("metadata[credits_amount_usd]", String(amountUsd));

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.url) {
    return {
      ok: false,
      provider_error: data?.error?.message || `Stripe error ${response.status}`,
      missing_env: [],
    } as const;
  }

  return {
    ok: true,
    checkout_url: String(data.url),
    checkout_id: String(data.id ?? ""),
  } as const;
}

async function createPayPalCheckout(params: {
  amountUsd: number;
  userId: string;
  email: string;
  req: Request;
}) {
  const { amountUsd, userId, email, req } = params;
  const clientId = cleanEnv(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.PAYPAL_CLIENT_SECRET);
  const env = cleanEnv(process.env.PAYPAL_ENV || "sandbox");

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      missing_env: [
        !clientId ? "PAYPAL_CLIENT_ID" : null,
        !clientSecret ? "PAYPAL_CLIENT_SECRET" : null,
      ].filter(Boolean),
    } as const;
  }

  const paypalBase = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResp = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const tokenData = await tokenResp.json().catch(() => null);
  const token = tokenData?.access_token;
  if (!tokenResp.ok || !token) {
    return {
      ok: false,
      provider_error: tokenData?.error_description || `PayPal auth error ${tokenResp.status}`,
      missing_env: [],
    } as const;
  }

  const appUrl = getAppUrl(req);
  const orderResp = await fetch(`${paypalBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: userId,
          custom_id: `${userId}:${amountUsd}`,
          amount: {
            currency_code: "USD",
            value: amountUsd.toFixed(2),
          },
          description: `Hermes credits pack $${amountUsd}`,
        },
      ],
      payer: {
        email_address: email,
      },
      application_context: {
        return_url: `${appUrl}/payment-success?provider=paypal&pack=${amountUsd}`,
        cancel_url: `${appUrl}/?checkout=cancelled`,
      },
    }),
  });

  const orderData = await orderResp.json().catch(() => null);
  const approvalUrl = orderData?.links?.find((link: { rel?: string; href?: string }) => link.rel === "approve")?.href;

  if (!orderResp.ok || !approvalUrl) {
    return {
      ok: false,
      provider_error: orderData?.message || `PayPal order error ${orderResp.status}`,
      missing_env: [],
    } as const;
  }

  return {
    ok: true,
    checkout_url: String(approvalUrl),
    checkout_id: String(orderData.id ?? ""),
  } as const;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    provider?: Provider;
    package_usd?: number;
  };

  const provider = body.provider;
  const amountUsd = Number(body.package_usd ?? 0);

  if ((provider !== "stripe" && provider !== "paypal") || !isSupportedAmount(amountUsd)) {
    return NextResponse.json({ ok: false, error: "Invalid provider or package amount" }, { status: 400 });
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

  if (profile.unlimited_credits) {
    return NextResponse.json({
      ok: false,
      error: "Test users already have unlimited credits",
      credits: toCreditSummary(profile),
    }, { status: 400 });
  }

  const result = provider === "stripe"
    ? await createStripeCheckout({ amountUsd, userId: userData.user.id, email: userData.user.email ?? "", req })
    : await createPayPalCheckout({ amountUsd, userId: userData.user.id, email: userData.user.email ?? "", req });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        setup_required: (result.missing_env?.length ?? 0) > 0,
        missing_env: result.missing_env ?? [],
        provider_error: "provider_error" in result ? result.provider_error : null,
        error: "Checkout provider not fully configured yet",
        credits: toCreditSummary(profile),
      },
      { status: 501 },
    );
  }

  return NextResponse.json({
    ok: true,
    provider,
    package_usd: amountUsd,
    checkout_url: result.checkout_url,
    checkout_id: result.checkout_id,
    credits: toCreditSummary(profile),
  });
}
