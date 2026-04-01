export const APPROVED_GOOGLE_EMAILS = [
  "lauroalvarado@gmail.com",
  "desarrolladorassitantsai@gmail.com",
] as const;

export function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

export function isApprovedGoogleEmail(email?: string | null) {
  return APPROVED_GOOGLE_EMAILS.includes(normalizeEmail(email) as (typeof APPROVED_GOOGLE_EMAILS)[number]);
}
