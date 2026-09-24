// ============================================================================
// NEXT.JS 16 PROXY — INTERCEPTOR EDGE RUNTIME
// Antes llamado middleware.ts (Next.js < 16). La funcionalidad es idéntica.
// Se ejecuta ANTES de cualquier renderizado de Next.js.
// Primera capa de seguridad del sistema.
//
// Guía 0.5: definió las rutas públicas y el patrón de coincidencia por
// igualdad exacta o subruta real.
// Guía 0.11: agrega /auth/callback a la lista — es el punto de aterrizaje
// del correo de recuperación (Supabase lo carga sin sesión previa).
// ============================================================================

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
    // Paso 1: renovar cookies de sesión y obtener el usuario validado
    // Si el usuario no tiene sesión válida, user = null
    const { supabaseResponse, user } = await updateSession(request)
    const { pathname } = request.nextUrl

    // ── Rutas públicas ────────────────────────────────────────────────────────
    // Accesibles sin sesión. El proxy las deja pasar con las cookies actualizadas.
    //
    // ⚠️ La raíz va APARTE y con igualdad exacta: toda ruta empieza con '/', así que
    //    un startsWith('/') haría pública TODA la app y el bloque privado de abajo
    //    quedaría inalcanzable. Compila, no lanza error, y no protege nada.
    //
    // /auth/callback (Guía 0.11) es el aterrizaje del correo de recuperación:
    //   1) llega sin sesión — Supabase la crea al intercambiar el `code`
    //   2) llega con sesión (usuario que ya estaba logueado en otra pestaña) —
    //      igual debe pasar para que el route handler decida el próximo destino
    const RUTAS_PUBLICAS = ['/login', '/auth/callback']

    const esPublica =
        pathname === '/' ||
        RUTAS_PUBLICAS.some(
            // Coincidencia exacta o subruta real: '/login/recuperar' sí, '/loginfalso' no.
            ruta => pathname === ruta || pathname.startsWith(ruta + '/')
        )

    if (esPublica) {
        // Usuario autenticado que navega manualmente a /login o /
        // → redirigir al dashboard, no tiene sentido mostrarle el login
        //
        // /auth/callback queda FUERA de esta condición a propósito: aunque el
        // usuario tenga sesión, el callback tiene que ejecutar el intercambio
        // de `code` y decidir a dónde ir (p.ej. /login/reset con la sesión
        // temporal PASSWORD_RECOVERY recién creada).
        if (user && (pathname === '/' || pathname === '/login')) {
            return Response.redirect(new URL('/dashboard', request.url))
        }
        // Resto de rutas públicas: dejar pasar con las cookies actualizadas
        return supabaseResponse
    }

    // ── Rutas privadas ────────────────────────────────────────────────────────
    // Sin token válido → redirigir a /login
    if (!user) {
        return Response.redirect(new URL('/login', request.url))
    }

    // Token válido en ruta privada → permitir acceso
    // IMPORTANTE: retornar supabaseResponse, no NextResponse.next()
    // supabaseResponse ya tiene las cookies actualizadas — crear una nueva response las perdería
    return supabaseResponse
}

export const config = {
    matcher: [
        // Interceptar todos los paths EXCEPTO:
        // - _next/static  → JS y CSS generados por Next.js
        // - _next/image   → imágenes optimizadas por Next.js
        // - favicon.ico   → ícono del navegador
        // - Archivos con extensión de imagen (svg, png, jpg, jpeg, gif, webp)
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
