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
  });
}
