'use server'

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD ACTIONS — Server Actions del cambio y recuperación de contraseña
// (Guía 0.11 Partes 1 y 4)
//
// Tres Server Actions:
//   1. iniciarRecuperacionAction(email)
//        - Envía correo con enlace de reset — respuesta OPACA (defensa contra
//          enumeración): si el correo no existe, igual devuelve success.
//   2. establecerNuevaPasswordAction(nueva)
//        - Consume la sesión temporal PASSWORD_RECOVERY creada por /auth/callback
//          y establece la nueva contraseña. Cierra la sesión al terminar.
//        - PARTE 4: además persiste user_metadata.password_changed_once = true
//   3. cambiarPasswordAction(actual, nueva)
//        - Cambio con sesión activa. Verifica la actual con signInWithPassword
//          para no depender de contraseña débil "olvidada". Mantiene sesión.
//        - PARTE 4: además persiste user_metadata.password_changed_once = true
//
// Todas devuelven { success: true } | { success: false, error: string }.
// Toda escritura corre en servidor bajo cookie del usuario — nunca service_role.
// ═══════════════════════════════════════════════════════════════════════════════

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { validarPassword } from '@/lib/validations/password'
import type { RecuperacionResponse, CambioPasswordResponse } from '@/types/auth'

// ── Helper — origin absoluto del request (para redirectTo del correo) ──────
// En route handlers hay `request.url`; en Server Actions no. Se lee de headers.
async function origenAbsoluto(): Promise<string> {
    const h = await headers()
    // Vercel/Next 16 exponen x-forwarded-host y x-forwarded-proto en cualquier
    // reverse-proxy. Fallback a host directo para dev local.
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const proto = h.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${host}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. iniciarRecuperacionAction(email)
// ═══════════════════════════════════════════════════════════════════════════════
export async function iniciarRecuperacionAction(
    email: string,
): Promise<RecuperacionResponse> {
    // Validación mínima de formato para no molestar a Supabase con basura.
    // La validación estricta la hace el cliente con Zod (Parte 2 B3).
    const emailNormalizado = email.trim().toLowerCase()
    if (!emailNormalizado || !emailNormalizado.includes('@')) {
        // Aun con email inválido devolvemos success — mismo motivo que
        // el caso "no existe": no revelar información al atacante.
        return { success: true }
    }

    const supabase = await createClient()
    const origen = await origenAbsoluto()

    const { error } = await supabase.auth.resetPasswordForEmail(
        emailNormalizado,
        {
            // El correo llega con: /auth/callback?code=XXX&next=/login/reset
            // El route handler canjea el code por sesión temporal y redirige.
            redirectTo: `${origen}/auth/callback?next=/login/reset`,
        },
    )

    if (error) {
        // Rate-limit del proveedor u otra falla de infraestructura. NO se
        // discrimina "correo no existe" (Supabase igual responde success en
        // ese caso — ver docs auth.resetPasswordForEmail).
        // Un rate-limit sí es señal al usuario legítimo: se reporta como error.
        const esRateLimit = /rate limit|60 seconds|too many/i.test(error.message)
        if (esRateLimit) {
            return {
                success: false,
                error: 'Demasiadas solicitudes. Espera un minuto antes de volver a intentar.',
            }
        }
        // Otros errores: opacos (no revelar detalle técnico).
        return { success: true }
    }

    return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. establecerNuevaPasswordAction(nueva)
// ═══════════════════════════════════════════════════════════════════════════════
export async function establecerNuevaPasswordAction(
    nueva: string,
): Promise<CambioPasswordResponse> {
    // Validar política ANTES de gastar el updateUser: si es débil, el servidor
    // rechaza sin consumir la sesión temporal (que sigue viva para reintento).
    const validation = validarPassword(nueva)
    if (!validation.isValid) {
        return {
            success: false,
            error: 'La contraseña no cumple con los requisitos de seguridad.',
        }
    }

    const supabase = await createClient()

    // La sesión temporal PASSWORD_RECOVERY debe estar viva. Si no lo está
    // (link caducado, aterrizaje en frío), getUser devuelve null.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return {
            success: false,
            error: 'El enlace de recuperación caducó. Solicita uno nuevo.',
        }
    }

    // updateUser con `data`: además de cambiar el password, marca el flag
    // user_metadata.password_changed_once = true (Guía 0.11 Parte 4).
    // Un solo request al proveedor — sin doble round-trip.
    const { error } = await supabase.auth.updateUser({
        password: nueva,
        data: { password_changed_once: true },
    })
    if (error) {
        // Errores comunes: "New password should be different from the old password"
        // (Supabase valida esto server-side). Traducir para UX.
        const esMisma = /different from the old|same as the old/i.test(error.message)
        if (esMisma) {
            return {
                success: false,
                error: 'La nueva contraseña debe ser distinta a la anterior.',
            }
        }
        return {
            success: false,
            error: 'No pudimos guardar la nueva contraseña. Intenta de nuevo.',
        }
    }

    // Cerrar la sesión temporal. El próximo login (con la nueva contraseña)
    // es la señal de que todo funcionó.
    await supabase.auth.signOut()
    return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. cambiarPasswordAction(actual, nueva)
// ═══════════════════════════════════════════════════════════════════════════════
export async function cambiarPasswordAction(
    actual: string,
    nueva: string,
): Promise<CambioPasswordResponse> {
    // 1) Política — antes de gastar el signIn de verificación
    const validation = validarPassword(nueva)
    if (!validation.isValid) {
        return {
            success: false,
            error: 'La contraseña no cumple con los requisitos de seguridad.',
        }
    }

    const supabase = await createClient()

    // 2) Sesión viva — misma verificación defensiva que el resto de las actions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
        return {
            success: false,
            error: 'Tu sesión expiró. Inicia sesión de nuevo.',
        }
    }

    // 3) Verificar la actual con signInWithPassword.
    //    Supabase no expone "checkPassword" — el patrón oficial es re-autenticar.
    //    Se hace con la sesión activa: si la actual es correcta, la cookie NO
    //    cambia (mismo user). Si es incorrecta, Supabase devuelve
    //    "Invalid login credentials" y salimos sin tocar nada.
    const { error: errorVerif } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: actual,
    })
    if (errorVerif) {
        return { success: false, error: 'La contraseña actual es incorrecta.' }
    }

    // 4) Cambio real + marcado del flag persistente (Guía 0.11 Parte 4).
    //    Un solo updateUser hace ambas cosas.
    const { error: errorCambio } = await supabase.auth.updateUser({
        password: nueva,
        data: { password_changed_once: true },
    })
    if (errorCambio) {
        const esMisma = /different from the old|same as the old/i.test(errorCambio.message)
        if (esMisma) {
            return {
                success: false,
                error: 'La nueva contraseña debe ser distinta a la actual.',
            }
        }
        return {
            success: false,
            error: 'No pudimos guardar la nueva contraseña. Intenta de nuevo.',
        }
    }

    // Sesión sigue viva — el usuario continúa trabajando en /dashboard/perfil
    return { success: true }
}
