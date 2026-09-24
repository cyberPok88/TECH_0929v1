import { createBrowserClient } from "@supabase/ssr";

/**
 * createClient — Cliente Supabase para Client Components.
 *
 * Usa @supabase/ssr con createBrowserClient para App Router.
 * Maneja sesion en el navegador, sincronizacion entre pestanas
 * y refresco automatico de tokens.
 *
 * Uso en Client Components:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('tabla').select()
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
