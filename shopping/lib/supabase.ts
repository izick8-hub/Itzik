import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// The existing environment variable accepts both legacy anon JWTs and modern
// sb_publishable_ keys. Pass it unchanged: supabase-js handles API-key headers.
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
