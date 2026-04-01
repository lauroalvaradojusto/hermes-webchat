"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace("/");
    }, 300);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 backdrop-blur-xl">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
        Finalizando acceso de Google…
      </div>
    </div>
  );
}
