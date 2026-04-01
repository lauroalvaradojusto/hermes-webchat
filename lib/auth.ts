export const APPROVED_GOOGLE_EMAILS = [
  "lauroalvarado@gmail.com",
  "desarrolladorassitantsai@gmail.com",
] as const;

export function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

function getConfiguredApprovedEmails() {
  const envList = (process.env.NEXT_PUBLIC_APPROVED_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return new Set<string>([
    ...APPROVED_GOOGLE_EMAILS.map((email) => normalizeEmail(email)),
    ...envList,
  ]);
}

export function isApprovedGoogleEmail(email?: string | null) {
  return getConfiguredApprovedEmails().has(normalizeEmail(email));
}
