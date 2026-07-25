import { createClient } from "@supabase/supabase-js";

// Server-only client using the service_role key. This must never be
// imported into a "use client" component or exposed to the browser -
// it bypasses Row Level Security entirely, which is fine here because
// it's only ever used inside API route handlers (app/api/**/route.ts),
// which run on the server.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "in your environment (see .env.example)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: {
      // Next.js's App Router patches the global fetch() to cache GET
      // requests by default. Supabase's client issues its REST calls via
      // fetch under the hood, so without this override, every read here
      // could silently return a stale cached snapshot forever - even right
      // after a write - regardless of page refreshes on the browser side
      // (this is server-side infrastructure caching, which a browser
      // refresh can't clear). This is very likely why rates/config/stock
      // appeared "stuck" no matter how the app was refreshed.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
