import ShaderBackground from "@/components/ui/shader-background";
import { ShaderAnimation } from "@/components/ui/shader-animation";

export default function DemoPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <ShaderBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <section className="rounded-2xl border border-white/20 bg-black/30 p-8 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.25em] text-white/70">Hero / Landing</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">ShaderBackground</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/80">
            Use this one as a full-screen base layer for login, marketing, or transition screens.
            Keep content on top with backdrop blur for readability.
          </p>
        </section>

        <section className="relative h-[420px] overflow-hidden rounded-2xl border border-white/20 bg-black/60">
          <ShaderAnimation className="h-full w-full" />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20">
            <span className="text-center text-5xl font-semibold tracking-tight">Shader Animation</span>
          </div>
        </section>
      </div>
    </div>
  );
}
