export default function RandomShaderBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_30%),linear-gradient(180deg,rgba(9,9,11,0.95),rgba(3,7,18,1))]" />
      <div className="absolute left-[-10%] top-[-10%] h-[40rem] w-[40rem] animate-pulse rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[30rem] w-[30rem] animate-pulse rounded-full bg-accent/10 blur-3xl" />
    </div>
  );
}
