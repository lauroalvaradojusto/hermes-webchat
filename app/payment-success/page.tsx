import Link from "next/link";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const providerValue = params.provider;
  const packValue = params.pack;

  const provider = Array.isArray(providerValue) ? providerValue[0] : providerValue || "payment";
  const pack = Array.isArray(packValue) ? packValue[0] : packValue || "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Payment received</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Thanks. Your {provider} checkout {pack ? `for $${pack}` : ""} was completed.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Credit finalization webhook is prepared and will be connected as soon as provider API credentials are added.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Back to chat
          </Link>
        </div>
      </div>
    </div>
  );
}
