/*
 * NENE AI public authentication configuration.
 *
 * Fill these two fields only with the public Supabase project URL and publishable
 * key from the NENE AI Supabase project. The publishable/anon key is designed to
 * be public; NEVER put a service_role key, database password, or secret here.
 *
 * Authentication remains disabled while either value is empty.
 */
window.NENE_AUTH_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabaseAnonKey: "",
  redirectTo: window.location.origin + window.location.pathname
});
