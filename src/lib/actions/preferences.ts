'use server'

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTION — PREFERENCIAS DE USUARIO · Guía 0.6
//
// Persiste el tema en usuarios.preferencias para que siga al usuario entre
// dispositivos. El ThemeToggler la llama en fire-and-forget: el color ya cambió
// en pantalla antes de que esta acción termine.
//
// ⚠️ Depende de la política DUAL UPDATE sobre `usuarios` (Guía 0.4 · Parte 5):
//    UPDATE con `id = auth.uid()` restringido a la columna `preferencias`.
//    Sin ella la RLS descarta el UPDATE y NO lanza error — el síntoma es
//    "el tema no me sigue a otro dispositivo", nunca un mensaje de fallo.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import { describirError } from '@/lib/utils/errores'
import { TEMAS, type TemaValue } from '@/types/shell'
import { TIPOS_AYUDA, type PreferenciasAyudas } from '@/types/ayudas'

interface GuardarTemaResponse {
    success: boolean
    error?: string
}

export async function guardarTemaAction(tema: TemaValue): Promise<GuardarTemaResponse> {
    // ── Validación de entrada ──────────────────────────────────────────────────
    // Una Server Action es un endpoint HTTP público: puede llegar cualquier
    // string. Sin esto se escribiría basura en el JSONB y al recargar el
    // ThemeInjector aplicaría un data-theme inexistente.
    if (!TEMAS.some((t) => t.id === tema)) {
        return { success: false, error: 'Tema no reconocido' }
    }

    const supabase = await createClient()

    // getUser() verifica el JWT contra el servidor. getSession() lee de
    // localStorage y está prohibido por la regla ESLint de la Guía 0.1.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    // ── Merge parcial sobre el JSONB ───────────────────────────────────────────
    // `preferencias` está pensada para crecer. Escribir { tema } a secas
    // borraría cualquier clave futura. Lo natural sería jsonb_set(), pero eso
    // exigiría una función SQL nueva y esta guía no emite SQL (Parte 0, Dec. 1).
    const { data: fila } = await supabase
        .from('usuarios')
        .select('preferencias')
        .eq('id', user.id)
        .single()

    const previas = (fila?.preferencias ?? {}) as Record<string, unknown>

    const { error } = await supabase
        .from('usuarios')
        .update({ preferencias: { ...previas, tema } })
        .eq('id', user.id)

    if (error) {
        return { success: false, error: describirError(error) }
    }

    return { success: true }
}

/**
 * ⭐ MEJORA 47 (04 Oct 2026) — **las descripciones de pantalla** (`usuarios.preferencias.ayudas`).
 *
 * Mismo contrato y mismas defensas que `guardarTemaAction`: esto es un endpoint HTTP
 * público, así que la entrada se **valida**; y el JSONB se escribe con **merge parcial**
 * para no pisar las otras claves (`tema` sigue donde estaba).
 *
 * ⚠️ `ayudas` entra **completo** (igual que `tema`): el cliente manda el mapa ya
 *    fusionado. Escribirlo por partes exigiría `jsonb_set()` y esta guía no emite SQL.
 * ⚠️ La forma se valida contra `TIPOS_AYUDA`: un cuerpo con `{revision:{loquesea:true}}`
 *    se rechaza, en vez de guardar basura que después el `<Ayuda>` no sabría leer.
 */
export async function guardarAyudasAction(ayudas: PreferenciasAyudas): Promise<GuardarTemaResponse> {
    if (typeof ayudas !== 'object' || ayudas === null || Array.isArray(ayudas)) {
        return { success: false, error: 'Preferencia de descripciones inválida' }
    }
    for (const [modulo, categorias] of Object.entries(ayudas)) {
        if (!/^[a-z][a-z0-9_]*$/.test(modulo)) {
            return { success: false, error: 'Módulo inválido' }
        }
        if (typeof categorias !== 'object' || categorias === null || Array.isArray(categorias)) {
            return { success: false, error: 'Categorías inválidas' }
        }
        for (const [tipo, valor] of Object.entries(categorias)) {
            if (!TIPOS_AYUDA.includes(tipo as (typeof TIPOS_AYUDA)[number])) {
                return { success: false, error: `Categoría desconocida: ${tipo}` }
            }
            if (typeof valor !== 'boolean') {
                return { success: false, error: 'Valor no booleano' }
            }
        }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { data: fila } = await supabase
        .from('usuarios')
        .select('preferencias')
        .eq('id', user.id)
        .single()

    const previas = (fila?.preferencias ?? {}) as Record<string, unknown>

    const { error } = await supabase
        .from('usuarios')
        .update({ preferencias: { ...previas, ayudas } })
        .eq('id', user.id)

    if (error) {
        return { success: false, error: describirError(error) }
    }

    return { success: true }
}
