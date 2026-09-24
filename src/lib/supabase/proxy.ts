// ============================================================================
// SUPABASE CLIENT — PROXY / EDGE RUNTIME
// Usar EXCLUSIVAMENTE en: src/proxy.ts
// NO usar en: Server Components ni Client Components
// ============================================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Sincroniza las cookies de sesión de Supabase y valida el token.
 * Llamar al inicio de src/proxy.ts, antes de cualquier lógica de enrutamiento.
 *
 * @returns supabaseResponse — response con cookies actualizadas (SIEMPRE retornar esta)
 * @returns user — claims del JWT validado, o null si no hay sesión
 */
export async function updateSession(request: NextRequest) {
    // Response base — se reconstruye con las cookies actualizadas dentro de setAll
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                // Lee las cookies del request entrante
                getAll() {
                    return request.cookies.getAll()
                },
                // Escribe el token renovado en dos destinos:
                // 1. request.cookies → Server Components del mismo request lo leen sin re-fetch
                // 2. supabaseResponse.cookies → el navegador reemplaza su token viejo
                // Nota: @supabase/ssr 0.6.1 — setAll NO recibe headers como segundo parámetro
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    // Reconstruir la response con el request ya actualizado
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // ⚠️ CRÍTICO: No agregar código entre createServerClient y getClaims()
    // getClaims() valida la firma JWT localmente — sin petición HTTP a Supabase
    // NUNCA usar getSession() — lee el token sin validar (inseguro, bloqueado por ESLint)
    const { data } = await supabase.auth.getClaims()
    const user = data?.claims ?? null

    // IMPORTANTE: siempre retornar supabaseResponse tal como está
    // Crear una nueva response sin copiar las cookies de esta rompe la sesión
    return { supabaseResponse, user }
}
