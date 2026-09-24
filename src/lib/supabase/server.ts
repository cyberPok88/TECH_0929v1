import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * createClient — Cliente Supabase para Server Components y Server Actions.
 *
 * Usa @supabase/ssr con cookies() async de Next.js 16.
 * Lee la sesion del usuario desde las cookies y retorna un cliente autenticado.
 *
 * Uso en Server Components:
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('tabla').select()
 *
 * Uso en Server Actions:
 *   'use server'
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // setAll se llama desde un Server Component donde
                        // las cookies son de solo lectura. El error es esperado
                        // cuando un Server Action intenta establecer cookies
                        // que luego el middleware refresca.
                    }
                },
            },
        }
    );
}
