import { createClient } from "@supabase/supabase-js";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

// Los placeholders permiten que `next build` y el typecheck corran en CI sin
// copiar secretos/variables de Vercel a GitHub Actions. En el navegador de
// producción se usan siempre las variables NEXT_PUBLIC_* configuradas en Vercel.
const supabaseUrl = configuredUrl ?? "https://placeholder.supabase.co";
const supabasePublishableKey = configuredKey ?? "sb_publishable_ci_placeholder";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
