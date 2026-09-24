// ============================================================================
// SERVER ACTIONS — AUTENTICACIÓN
// 'use server' en línea 1: obligatorio, sin comentarios ni espacios antes.
// Retornan objetos tipados — NUNCA throw. Errores como strings de respuesta.
// ============================================================================

'use server'

import { createClient } from '@/lib/supabase/server'
import type {
    AuthActionResponse,
    CerrarSesionResponse,
    SesionCompletaResponse,
} from '@/types/auth'

// ── Iniciar sesión ────────────────────────────────────────────────────────────
// OPERACIÓN ATÓMICA (Decisión 5 de la Parte 0): signIn + RPC en la misma acción
// para que la cookie del login ya exista cuando se consulte la sesión completa.
export async function iniciarSesionAction(
    email: string,
    password: string
): Promise<AuthActionResponse> {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    })
    if (error) {
        if (
            error.code === 'invalid_credentials' ||
            error.message.includes('Invalid login credentials')
        ) {
            return { success: false, error: 'Correo o contraseña incorrectos.' }
        }
        return { success: false, error: error.message }
    }

    // Sesión creada: obtener la sesión completa en el mismo request
    const { data, error: sesionError } = await supabase.rpc('obtener_sesion_completa')
    if (sesionError) return { success: false, error: sesionError.message }

    const sesion = data as SesionCompletaResponse

    // Usuario con auth válido pero sin perfil (limbo): cerrar la sesión
    // para que el proxy no lo redirija a un dashboard sin datos
    if (sesion.error) {
        await supabase.auth.signOut()
        return { success: false, error: sesion.mensaje ?? 'Usuario sin perfil activo.' }
    }

    return { success: true, sesion }
}

// ── Registrarse ───────────────────────────────────────────────────────────────
// El trigger on_auth_user_created (Parte 1) decidió en la BD: primer usuario →
// perfil administrador; ya hay usuarios → no inserta. Esta acción solo reacciona.
export async function registrarseAction(
    nombre: string,
    email: string,
    password: string
): Promise<AuthActionResponse> {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
            // ⚠️ CONTRATO LITERAL CON LA BD — NO renombrar esta clave.
            // El trigger crear_usuario_desde_auth() (Guía 0.4 P4 B9) lee
            // raw_user_meta_data ->> 'nombre_completo'. Si aquí se manda otro
            // nombre, el COALESCE del trigger cae al alias del correo y el
            // administrador queda registrado con un nombre equivocado —
            // PARA SIEMPRE, sin error de build ni de runtime.
            data: { nombre_completo: nombre },
        },
    })
    if (error) {
        if (error.message.includes('already registered')) {
            return { success: false, error: 'Este correo ya tiene una cuenta. Inicia sesión.' }
        }

        // El trigger crear_usuario_desde_auth() (Guía 0.4 P4 B9) ABORTA con
        // EXCEPTION cuando el registro público está cerrado — así el correo no
        // queda consumido por un huérfano en auth.users.
        //
        // GoTrue envuelve el error de Postgres en un genérico ("Database error
        // saving new user"), así que NO se puede discriminar por el texto: se
        // le pregunta a la BD, que es quien decide.
        const { data: hayUsuarios } = await supabase.rpc('hay_usuarios_registrados')
        if (hayUsuarios === true) {
            return {
                success: false,
                error: 'El registro público está cerrado. Contacta al administrador.',
            }
        }

        return { success: false, error: error.message }
    }

    // Confirm email ON: no hay sesión todavía. El registro SÍ fue exitoso —
    // el login espera la confirmación del correo. Es un éxito en espera.
    if (!data.session) {
        return { success: true, requiereConfirmacion: true }
    }

    // Confirm email OFF: hay sesión y el trigger ya corrió en la misma
    // transacción (creó su perfil si era el primer usuario).
    const { data: sesionData, error: sesionError } =
        await supabase.rpc('obtener_sesion_completa')
    if (sesionError) return { success: false, error: sesionError.message }

    const sesion = sesionData as SesionCompletaResponse

    // Red de seguridad: hay sesión pero la RPC no devuelve perfil.
    //
    // El registro cerrado no llega aquí — el trigger aborta el signUp y ese
    // caso se resuelve arriba. Esta rama cubre el escenario que sí queda vivo:
    // un perfil que existe pero está inactivo o archivado, porque
    // obtener_sesion_completa() filtra por es_activo y es_archivado y responde
    // error aunque el token sea válido.
    // Se cierra la sesión para no dejar el limbo JWT-válido-sin-perfil.
    if (sesion.error) {
        await supabase.auth.signOut()
        return {
            success: false,
            error: 'Tu cuenta no está activa en el sistema. Contacta al administrador.',
        }
    }

    return { success: true, sesion }
}

// ── Rehidratar sesión ─────────────────────────────────────────────────────────
// AuthWrapper (Parte 5) la llama cuando hay cookie válida pero el store está
// vacío (refresh). Si error:true → el usuario es inválido/inactivo → /login.
export async function rehidratarSesionAction(): Promise<SesionCompletaResponse> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('obtener_sesion_completa')
    if (error) return { error: true, mensaje: error.message }
    return data as SesionCompletaResponse
}

// ── Cerrar sesión ─────────────────────────────────────────────────────────────
// Invalida el token en Supabase Auth. Quien la llama debe clearAuth() en el
// store y router.push('/login') después de recibir { success: true }.
export async function cerrarSesionAction(): Promise<CerrarSesionResponse> {
    try {
        const supabase = await createClient()
        await supabase.auth.signOut()
        return { success: true }
    } catch {
        // Sin throw: el error navega en la respuesta (convención del proyecto)
        return { success: false, error: 'No se pudo cerrar la sesión.' }
    }
}
