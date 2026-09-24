// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE HANDLER — /auth/callback  (Guía 0.11 Parte 2)
//
// Único punto de la app que canjea un `code` de Supabase por sesión.
// Lo cargan los correos mágicos: recuperación (0.11), y en el futuro
// invitación / cambio de correo si esos flujos se agregan.
//
// PATRÓN OFICIAL DE SUPABASE — PKCE flow:
//   1) Server Action llama resetPasswordForEmail() con redirectTo apuntando aquí
//   2) Supabase envía correo con link http://.../auth/callback?code=XXX&next=/login/reset
//   3) Usuario hace clic → llega acá
//   4) exchangeCodeForSession(code) crea sesión temporal PASSWORD_RECOVERY
//   5) Redirect al `next` (validado como ruta relativa)
//
// La sesión temporal solo sirve para llamar updateUser({ password }); la
// Server Action establecerNuevaPasswordAction (Parte 1 B3) la cierra después.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)

    const code = searchParams.get('code')
    const nextRaw = searchParams.get('next')

    // ── Validar `next` como ruta relativa ───────────────────────────────
    // Se acepta solo si empieza con `/` y no tiene `//` (protocolo implícito).
    // Cualquier otra cosa cae al fallback /dashboard.
    // Sin esta validación, un correo forjado con `?next=https://malicioso.com`
    // convertiría este callback en un open-redirect.
    const esNextSeguro =
        typeof nextRaw === 'string' &&
        nextRaw.startsWith('/') &&
        !nextRaw.startsWith('//')

    const next = esNextSeguro ? nextRaw : '/dashboard'

    // ── Falta el `code` — link mal armado o alterado ────────────────────
    if (!code) {
        return NextResponse.redirect(new URL('/login?err=callback', origin))
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        // Código inválido, caducado, o ya canjeado (Supabase invalida el
        // code después del primer uso — abrir el link dos veces cae aquí).
        return NextResponse.redirect(new URL('/login?err=callback', origin))
    }

    // Sesión temporal creada. Redirigir al destino validado.
    // La cookie de sesión viaja en la response porque createClient() ya la
    // enganchó al cookieStore en el intercambio.
    return NextResponse.redirect(new URL(next, origin))
}
