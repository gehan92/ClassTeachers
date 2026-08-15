import type { ReactNode } from "react";

export function AuthShell({
  quote,
  stats,
  children,
}: {
  quote: string;
  stats?: { value: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:min-h-[calc(100vh-77px)] md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary-dark px-14 py-12 text-white md:flex md:flex-col md:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 400px at 100% 100%, rgba(185,138,34,0.18), transparent 60%)",
          }}
        />
        <div />
        <p className="relative z-10 max-w-[32ch] font-display text-2xl leading-snug">{quote}</p>
        {stats ? (
          <div className="relative z-10 flex gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="font-mono">
                <div className="text-2xl font-semibold text-white">{stat.value}</div>
                <div className="text-xs tracking-wide text-white/60 uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div />
        )}
      </div>

      <div className="flex items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
