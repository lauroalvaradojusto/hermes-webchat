import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "@/lib/auth";

export const CREDIT_PACKAGES_USD = [4, 8, 16, 32, 64] as const;
export const NEW_USER_STARTING_CREDITS_USD = 3;
export const CHAT_MESSAGE_COST_USD = 1;

export type CreditProfile = {
  id: string;
  email: string;
  credits: number;
  unlimited_credits: boolean;
  plan_type: string;
};

export function cleanEnv(value?: string) {
  return (value ?? "").replace(/\\n/g, "").trim();
}

const DEFAULT_TEST_EMAILS = [
  "lauroalvarado@gmail.com",
  "desarrolladorassitantsai@gmail.com",
];

function getTestUserEmailsFromEnv() {
  const configured = cleanEnv(process.env.TEST_UNLIMITED_EMAILS)
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);

  return new Set<string>([...DEFAULT_TEST_EMAILS.map((email) => normalizeEmail(email)), ...configured]);
}

export function isTestUserEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getTestUserEmailsFromEnv().has(normalized);
}

export function createAuthedSupabaseClient(supabaseUrl: string, supabaseAnonKey: string, accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function isNoRowsError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  if (!candidate) return false;
  return candidate.code === "PGRST116" || /0 rows|no rows|not found/i.test(candidate.message ?? "");
}

async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,credits,unlimited_credits,plan_type")
    .eq("id", userId)
    .single();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  if (!data) return null;

  return {
    id: String(data.id),
    email: String(data.email ?? ""),
    credits: Number(data.credits ?? 0),
    unlimited_credits: Boolean(data.unlimited_credits),
    plan_type: String(data.plan_type ?? "starter"),
  } satisfies CreditProfile;
}

export async function ensureCreditProfile(params: {
  supabase: SupabaseClient;
  userId: string;
  email: string;
}) {
  const { supabase, userId, email } = params;
  const testUser = isTestUserEmail(email);

  const existing = await getProfile(supabase, userId);
  if (!existing) {
    const payload = {
      id: userId,
      email: normalizeEmail(email),
      credits: testUser ? 999999 : NEW_USER_STARTING_CREDITS_USD,
      unlimited_credits: testUser,
      plan_type: testUser ? "test-unlimited" : "starter",
    };

    const { data, error } = await supabase
      .from("profiles")
      .insert(payload)
      .select("id,email,credits,unlimited_credits,plan_type")
      .single();

    if (error) throw error;

    return {
      id: String(data.id),
      email: String(data.email ?? normalizeEmail(email)),
      credits: Number(data.credits ?? 0),
      unlimited_credits: Boolean(data.unlimited_credits),
      plan_type: String(data.plan_type ?? (testUser ? "test-unlimited" : "starter")),
    } satisfies CreditProfile;
  }

  if (testUser && !existing.unlimited_credits) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        unlimited_credits: true,
        plan_type: "test-unlimited",
      })
      .eq("id", userId)
      .select("id,email,credits,unlimited_credits,plan_type")
      .single();

    if (error) throw error;

    return {
      id: String(data.id),
      email: String(data.email ?? existing.email),
      credits: Number(data.credits ?? existing.credits),
      unlimited_credits: true,
      plan_type: String(data.plan_type ?? "test-unlimited"),
    } satisfies CreditProfile;
  }

  return existing;
}

export async function consumeChatCredit(params: {
  supabase: SupabaseClient;
  userId: string;
  profile: CreditProfile;
}) {
  const { supabase, userId, profile } = params;

  if (profile.unlimited_credits) return profile;
  const remaining = Math.max(0, profile.credits - CHAT_MESSAGE_COST_USD);

  const { data, error } = await supabase
    .from("profiles")
    .update({ credits: remaining })
    .eq("id", userId)
    .select("id,email,credits,unlimited_credits,plan_type")
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    email: String(data.email ?? profile.email),
    credits: Number(data.credits ?? remaining),
    unlimited_credits: Boolean(data.unlimited_credits),
    plan_type: String(data.plan_type ?? profile.plan_type),
  } satisfies CreditProfile;
}

export async function addCredits(params: {
  supabase: SupabaseClient;
  userId: string;
  profile: CreditProfile;
  amountUsd: number;
}) {
  const { supabase, userId, profile, amountUsd } = params;
  if (profile.unlimited_credits) return profile;

  const safeAmount = Number.isFinite(amountUsd) ? Math.max(0, amountUsd) : 0;
  const nextCredits = profile.credits + safeAmount;

  const { data, error } = await supabase
    .from("profiles")
    .update({ credits: nextCredits, plan_type: "paid" })
    .eq("id", userId)
    .select("id,email,credits,unlimited_credits,plan_type")
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    email: String(data.email ?? profile.email),
    credits: Number(data.credits ?? nextCredits),
    unlimited_credits: Boolean(data.unlimited_credits),
    plan_type: String(data.plan_type ?? "paid"),
  } satisfies CreditProfile;
}

export function toCreditSummary(profile: CreditProfile) {
  return {
    available_usd: profile.unlimited_credits ? null : profile.credits,
    unlimited: profile.unlimited_credits,
    plan_type: profile.plan_type,
    chat_message_cost_usd: CHAT_MESSAGE_COST_USD,
    packages_usd: [...CREDIT_PACKAGES_USD],
    currency: "USD",
    is_test_user: isTestUserEmail(profile.email),
  };
}
