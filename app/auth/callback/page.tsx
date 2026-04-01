"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const finalize = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const oauthError = url.searchParams.get("error") || url.searchParams.get("error_description");
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (oauthError) throw new Error(oauthError);

        if (code) {
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabaseBrowser.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        // Clean sensitive URL params before leaving callback route.
        window.history.replaceState({}, document.title, "/auth/callback");
        router.replace("/");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "OAuth callback failed");
      }
    };

    void finalize();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 backdrop-blur-xl">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
        {error ? `Google sign-in failed: ${error}` : "Finalizing Google sign-in…"}
      </div>
    </div>
  );
}
