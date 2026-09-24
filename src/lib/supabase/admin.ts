import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * createAdminClient — Cliente Supabase con service_role.
 *
 * IGNORA la RLS por completo. Usar SOLO dentro de Server Actions y solo para
 * operaciones de auth.admin.* que la anon key no puede ejecutar:
 * crear usuarios, generar enlaces de invitacion, actualizar auth.users.
 *
 * Para leer o escribir tablas de public se usa server.ts, que SI respeta la RLS.
 * Mezclar ambos usos en este cliente convierte cada politica del proyecto en decorativa.
 *
 * Uso en Server Actions:
 *   'use server'
 *   const admin = createAdminClient()
 *   const { data, error } = await admin.auth.admin.createUser({ ... })
 */
export function createAdminClient() {
    // Guard de contexto: la llave no es NEXT_PUBLIC_, asi que en el browser
    // llegaria undefined y el error hablaria de una variable faltante en vez
    // del problema real. Este mensaje dice lo que de verdad pasa.
    if (typeof window !== "undefined") {
        throw new Error(
            "createAdminClient() no puede ejecutarse en el navegador. " +
                "Es un cliente de servidor: usalo solo dentro de Server Actions."
        );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            "createAdminClient(): falta NEXT_PUBLIC_SUPABASE_URL o " +
                "SUPABASE_SERVICE_ROLE_KEY en .env.local"
        );
    }

    return createSupabaseClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
