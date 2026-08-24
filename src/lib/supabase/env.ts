/**
 * Fails fast with a clear message instead of a cryptic runtime error deep
 * inside the Supabase client if the project hasn't been connected yet.
 *
 * Takes the value itself, not the var name to look up — `process.env` must
 * be accessed as a literal `process.env.NEXT_PUBLIC_X` member expression at
 * each call site, not through a dynamic `process.env[name]` lookup inside
 * a shared helper. Next.js inlines NEXT_PUBLIC_* vars into the browser
 * bundle by statically finding that exact literal expression at build
 * time; it can't trace a variable name through a function call. A dynamic
 * lookup works fine server-side (Node has a real process.env object at
 * runtime there regardless), which is why this was invisible until
 * something client-side finally needed one of these values.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.local.example to .env.local and fill in your Supabase project's ` +
        `URL and anon key (Project Settings -> API in the Supabase dashboard).`,
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server-only — never import this from a Client Component. */
export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
