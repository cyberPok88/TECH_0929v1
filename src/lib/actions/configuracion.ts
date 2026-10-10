'use server'

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — CONFIGURACIÓN DEL SISTEMA · Guía 2.4 (05 Oct 2026)
//
// El único camino del cliente a las 4 RPC de la herramienta de borrado.
//
// 🔑 DOS CONTRATOS QUE ROMPEN SI SE IGNORAN:
//
//  ① EL CLIENTE ES EL DE LA SESIÓN (`@/lib/supabase/server`), NO `createAdminClient()`.
//     Los DOS gates de `borrar_datos_erp()` leen `auth.uid()`: `tiene_permiso_accion()`
//     y `es_admin_principal()` buscan al usuario de la sesión. Con el service role no
//     hay `auth.uid()` ⇒ los dos devuelven false ⇒ la RPC rechaza AL PROPIO DUEÑO.
//     El síntoma («Solo el dueño puede borrar» con el dueño logueado) parece de
//     permisos y no lo es.
//
//  ② EL GATE DE ENTORNO VIVE ACÁ, no solo en la pantalla. Ocultar el botón NO es un
//     candado: si la action se llama desde otro lado, esta línea es lo único que
//     impide el borrado. Fail-closed: sin `ENTORNO=desarrollo`, no borra.
//
//  ③ ⭐ FIX `g26_p1_b9` (07 Oct 2026) — **EL PAQUETE QUE FALTA VIAJA EN `DETAIL`**. La RPC
//     sabe qué tabla bloqueó el borrado y de qué paquete es; lo manda en el `DETAIL` del
//     error para que el modal ofrezca marcarlo **en un clic**, en vez de dejar al usuario
//     adivinando qué casilla le falta.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import { permiteBorradoBd } from '@/lib/utils/entorno'
import {
    PAQUETES,
    TABLAS_CATALOGO,
    type FilaCatalogo,
    type FilaConteo,
    type PaqueteBorrado,
    type SeleccionFilas,
    type TablaCatalogo,
} from '@/types/configuracion'

// Traductor de errores de PostgreSQL a mensaje legible.
//
// ⭐ 05 Oct 2026 — **y la última línea es la importante**: el fallback incluye el CÓDIGO.
// La casa tiene 8 traductores con esta firma (`traducirErrorRol`, `traducirErrorCliente`…)
// y todos caen a `return mensaje` **pelado**. Eso costó una sesión entera de diagnóstico:
// el toast decía «DELETE requires a WHERE clause» sin código, y no había forma de saber
// quién lo producía. ⇒ **Un error que se muestra recortado no es un error, es un acertijo.**
//
// ⚠️ `P0001` es el `RAISE EXCEPTION` de nuestras propias RPC: esos mensajes YA están
//    escritos en español y para el usuario («Sin permiso: falta la acción…», «Solo el
//    dueño…»), así que se devuelven **tal cual** — traducirlos los empeoraría.
function traducirErrorConfiguracion(codigo: string | undefined, mensaje: string): string {
    if (codigo === 'P0001') return mensaje
    if (codigo === '42501') return 'Tu usuario no tiene permiso para esta operación.'
    if (codigo === '23503') {
        return 'No se puede borrar: hay registros de OTRO grupo que dependen de lo marcado.'
    }
    if (codigo === '23514') return 'El borrado choca con una restricción de la base.'
    return codigo ? `${mensaje} (${codigo})` : mensaje
}

interface Respuesta<T> {
    success: boolean
    data?: T
    error?: string
    /**
     * ⭐ **El paquete que faltaba marcar** cuando una FK de OTRO paquete bloqueó el borrado
     * (FIX `g26_p1_b9`). Lo manda la RPC en el `DETAIL` del error; el modal lo usa para
     * ofrecer marcarlo en un clic. Ausente = no hay nada accionable que ofrecer.
     */
    paqueteFaltante?: PaqueteBorrado
}

/**
 * El paquete que la RPC señaló como faltante, **validado contra la lista blanca**.
 *
 * ⚠️ El `DETAIL` viene de la BD: si no es uno de los 11 ids conocidos, se descarta. La UI
 * nunca marca una casilla a partir de un texto que no reconoce.
 */
function paqueteFaltanteDe(detalle: string | null | undefined): PaqueteBorrado | undefined {
    if (!detalle) return undefined
    return (PAQUETES as readonly string[]).includes(detalle) ? (detalle as PaqueteBorrado) : undefined
}

/** Valida que lo que llegó sea un subconjunto de la lista blanca. */
function paquetesValidos(entrada: unknown): PaqueteBorrado[] | null {
    if (entrada === undefined || entrada === null) return []
    if (!Array.isArray(entrada)) return null
    const validos: PaqueteBorrado[] = []
    for (const p of entrada) {
        if (typeof p !== 'string' || !(PAQUETES as readonly string[]).includes(p)) return null
        validos.push(p as PaqueteBorrado)
    }
    return validos
}

/**
 * ⭐ **El candado de la herramienta**: cuántas filas se pierden por paquete y por tabla.
 *
 * ⚠️ Devuelve el **radio de explosión** — la tabla nombrada **y** lo que cae con ella por
 *    `CASCADE`. Un paquete «Entradas» con 3 entradas puede ser 13 filas en 7 tablas.
 */
export async function contarPaquetesAction(paquetes?: PaqueteBorrado[]): Promise<Respuesta<FilaConteo[]>> {
    const lista = paquetesValidos(paquetes)
    if (lista === null) return { success: false, error: 'Paquete no reconocido' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { data, error } = await supabase.rpc('contar_datos_erp', {
        // `null` = contar los 11 paquetes (lo usa el borrado total).
        p_paquetes: lista.length > 0 ? lista : null,
    })
    if (error) return { success: false, error: traducirErrorConfiguracion(error.code, error.message) }
    return { success: true, data: (data ?? []) as FilaConteo[] }
}

/** Las filas de un catálogo, con su fecha de alta y en cuántos productos se usan. */
export async function listarCatalogoAction(tabla: TablaCatalogo): Promise<Respuesta<FilaCatalogo[]>> {
    if (!(TABLAS_CATALOGO as readonly string[]).includes(tabla)) {
        return { success: false, error: 'Catálogo no reconocido' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { data, error } = await supabase.rpc('listar_catalogo', { p_tabla: tabla })
    if (error) return { success: false, error: traducirErrorConfiguracion(error.code, error.message) }
    return { success: true, data: (data ?? []) as FilaCatalogo[] }
}

/** Los roles no-sistema, con **cuántos usuarios lo tienen** (`usuarios.id_rol` es RESTRICT). */
export async function listarRolesBorrablesAction(): Promise<Respuesta<FilaCatalogo[]>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { data, error } = await supabase.rpc('listar_roles_borrables')
    if (error) return { success: false, error: traducirErrorConfiguracion(error.code, error.message) }
    // El contrato de la UI quiere `nombre`: para un rol, la clave es lo que se lee.
    const filas = ((data ?? []) as { id: string; clave: string; nombre: string; usuarios: number }[]).map(
        (r) => ({ id: r.id, nombre: r.clave, created_at: '', usos: r.usuarios })
    )
    return { success: true, data: filas }
}

/**
 * ⭐ **EL BORRADO.** Llama a `borrar_datos_erp()`, que corre **en una sola transacción** y en el
 * orden que impone la FK (no el que marcó el usuario).
 *
 * ⚠️ Si una FK `RESTRICT` lo bloquea, la RPC lanza y **no se borra nada**: el error se devuelve tal
 *    cual para que el modal lo muestre, en vez de dejar al usuario con un borrado a medias.
 * 🔑 El candado de entorno se evalúa **antes** de tocar la RPC.
 */
export async function borrarDatosAction(entrada: {
    paquetes: PaqueteBorrado[]
    seleccion?: SeleccionFilas
    reiniciarFolios?: boolean
}): Promise<Respuesta<FilaConteo[]>> {
    // ── GATE 3 · el entorno (fail-closed) ──────────────────────────────────────
    if (!permiteBorradoBd()) {
        return {
            success: false,
            error: 'El borrado de datos está deshabilitado en este entorno.',
        }
    }

    const lista = paquetesValidos(entrada?.paquetes)
    if (lista === null) return { success: false, error: 'Paquete no reconocido' }
    if (lista.length === 0) return { success: false, error: 'No se marcó ningún paquete' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { data, error } = await supabase.rpc('borrar_datos_erp', {
        p_paquetes: lista,
        p_seleccion: (entrada?.seleccion ?? {}) as never,
        p_reiniciar_folios: entrada?.reiniciarFolios === true,
    })
    if (error) {
        return {
            success: false,
            error: traducirErrorConfiguracion(error.code, error.message),
            paqueteFaltante: paqueteFaltanteDe(error.details),
        }
    }
    return { success: true, data: (data ?? []) as FilaConteo[] }
}
