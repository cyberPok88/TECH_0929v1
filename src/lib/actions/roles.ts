// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — ROLES Y EDITOR DE PERMISOS (Guía 0.10)
// 'use server' en la línea 1: obligatorio, sin comentarios ni espacios antes.
// Retornan objetos tipados — NUNCA throw (Decisión 17).
//
//   Parte 1: listarRoles · listarArbolPermisos
//   Parte 2: + crearRol
//   Parte 3: + editarRol · eliminarRol
//   Parte 4 (aquí): + obtenerPermisosRol · guardarPermisosRol · restablecerPermisosRol
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import { createClient } from '@/lib/supabase/server'
import { rolCrearSchema, rolEditarSchema } from '@/lib/validations/roles'
import type { RolCrearInput, RolEditarInput } from '@/lib/validations/roles'
import { PERMISOS_SEMILLA, ACCIONES_EDITOR } from '@/types/roles'
import type {
    RolLista,
    FiltrosRoles,
    PermisoPayload,
    AccionEditor,
    ModuloPermisos,
    SubmoduloPermisos,
    RespuestaLista,
    RespuestaAccion,
} from '@/types/roles'

// Forma cruda del catálogo: modulos y submodulos (solo lectura, grant SELECT).
interface FilaModuloCruda {
    id: string
    nombre: string
    icono: string
    orden: number
}

interface FilaSubmoduloCruda {
    id: string
    id_modulo: string
    href: string
    nombre: string
    orden: number
}

// Forma cruda del embed de permisos_acciones → submodulos(href) + acciones(clave).
interface FilaPermisoCruda {
    submodulos: { href: string } | null
    acciones: { clave: string } | null
}

// Traductor de errores de PostgreSQL a mensaje legible.
function traducirErrorRol(codigo: string | undefined, mensaje: string): string {
    if (codigo === '23505') return 'Ya existe un rol con esa clave.'
    if (codigo === '23514') return 'El nivel jerárquico debe ser mayor que 0.'
    return mensaje
}

// ── Listar roles ─────────────────────────────────────────────────────────────
export async function listarRoles(filtros: FiltrosRoles): Promise<RespuestaLista<RolLista>> {
    const supabase = await createClient()

    let query = supabase
        .from('roles')
        .select('id, clave, nombre, descripcion, nivel_jerarquico, es_sistema, es_editable, created_at')

    // Tipo: 'sistema' = rol de semilla — es_sistema true (administrador) O clave
    // en PERMISOS_SEMILLA (los 6 editables). 'personalizado' = fuera de la semilla.
    // 'todos' → sin filtro de tipo.
    const clavesSemilla = Object.keys(PERMISOS_SEMILLA)
    if (filtros.tipo === 'sistema') {
        query = query.or(`es_sistema.eq.true,clave.in.(${clavesSemilla.join(',')})`)
    } else if (filtros.tipo === 'personalizado') {
        query = query.not('clave', 'in', clavesSemilla).eq('es_sistema', false)
    }

    const { data, error } = await query.order('nivel_jerarquico', { ascending: true })
    if (error) return { success: false, error: error.message }

    return { success: true, data: (data ?? []) as RolLista[] }
}

// ── Árbol de permisos (módulo → submódulos) para el editor ───────────────────
export async function listarArbolPermisos(): Promise<RespuestaLista<ModuloPermisos>> {
    const supabase = await createClient()

    const { data: modulos, error: errorModulos } = await supabase
        .from('modulos')
        .select('id, nombre, icono, orden')
        .eq('es_activo', true)
        .order('orden', { ascending: true })

    if (errorModulos) return { success: false, error: errorModulos.message }

    const { data: submodulos, error: errorSub } = await supabase
        .from('submodulos')
        .select('id, id_modulo, href, nombre, orden')
        .eq('es_activo', true)
        .order('orden', { ascending: true })

    if (errorSub) return { success: false, error: errorSub.message }

    const porModulo = new Map<string, SubmoduloPermisos[]>()
    for (const s of (submodulos ?? []) as FilaSubmoduloCruda[]) {
        const lista = porModulo.get(s.id_modulo) ?? []
        lista.push({ id: s.id, href: s.href, nombre: s.nombre })
        porModulo.set(s.id_modulo, lista)
    }

    const arbol: ModuloPermisos[] = ((modulos ?? []) as FilaModuloCruda[])
        .map((m) => ({
            id: m.id,
            nombre: m.nombre,
            icono: m.icono,
            orden: m.orden,
            submodulos: porModulo.get(m.id) ?? [],
        }))
        .filter((m) => m.submodulos.length > 0)

    return { success: true, data: arbol }
}

// ── Crear rol (Decisión 11 · R5) ─────────────────────────────────────────────
export async function crearRol(
    input: RolCrearInput,
    permisos?: PermisoPayload[]
): Promise<RespuestaAccion> {
    const parsed = rolCrearSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const datos = parsed.data

    const supabase = await createClient()

    const { data: rol, error: errorAlta } = await supabase
        .from('roles')
        .insert({
            clave: datos.clave,
            nombre: datos.nombre.trim(),
            nivel_jerarquico: datos.nivel_jerarquico,
            descripcion: datos.descripcion?.trim() || null,
        })
        .select('clave')
        .single()

    if (errorAlta) {
        return { success: false, error: traducirErrorRol(errorAlta.code, errorAlta.message) }
    }

    if (permisos && permisos.length > 0) {
        const { error: errorPermisos } = await supabase.rpc('guardar_permisos_rol', {
            p_clave_rol: rol.clave,
            p_permisos: permisos,
        })
        if (errorPermisos) {
            return {
                success: false,
                error: 'Rol creado, pero no se copiaron los permisos: ' +
                    errorPermisos.message +
                    '. Configúralos desde el editor.',
            }
        }
    }

    return { success: true }
}

// ── Editar rol (R1: clave inmutable; R3) ─────────────────────────────────────
export async function editarRol(id: string, input: RolEditarInput): Promise<RespuestaAccion> {
    const parsed = rolEditarSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const datos = parsed.data

    const supabase = await createClient()

    const { data: rol } = await supabase.from('roles').select('es_editable').eq('id', id).single()
    if (!rol) return { success: false, error: 'Rol no encontrado.' }
    if (!rol.es_editable) {
        return { success: false, error: 'Este rol es de sistema y no se puede modificar.' }
    }

    const { error } = await supabase
        .from('roles')
        .update({
            nombre: datos.nombre.trim(),
            nivel_jerarquico: datos.nivel_jerarquico,
            descripcion: datos.descripcion?.trim() || null,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorRol(error.code, error.message) }
    return { success: true }
}

// ── Eliminar rol — hard, tres capas (R7 · R8) ────────────────────────────────
export async function eliminarRol(id: string): Promise<RespuestaAccion> {
    const supabase = await createClient()

    // 1. Gate del dueño (R8) — re-verificado en servidor, no se fía del store.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Sin sesión.' }
    const { data: yo } = await supabase
        .from('usuarios')
        .select('es_admin_principal')
        .eq('id', user.id)
        .single()
    if (!yo?.es_admin_principal) {
        return { success: false, error: 'Solo el dueño del sistema puede eliminar roles.' }
    }

    const { data: rol } = await supabase
        .from('roles')
        .select('clave, es_sistema, es_editable')
        .eq('id', id)
        .single()
    if (!rol) return { success: false, error: 'Rol no encontrado.' }
    // ⭐ MEJORA 20 Ago — "de sistema" = es_sistema O clave en PERMISOS_SEMILLA
    // (los 7 de la 0.4 no se eliminan, aunque es_sistema=false en los editables).
    if (rol.es_sistema || !rol.es_editable || Boolean(PERMISOS_SEMILLA[rol.clave])) {
        return { success: false, error: 'Este rol es de sistema y no se puede eliminar.' }
    }

    const { error } = await supabase.from('roles').delete().eq('id', id)
    if (error) {
        if (error.code === '23503' && error.message.includes('fk_usuarios_rol')) {
            const { count } = await supabase
                .from('usuarios')
                .select('id', { count: 'exact', head: true })
                .eq('id_rol', id)
            const n = count ?? 0
            return {
                success: false,
                error: `Hay ${n} usuarios con este rol — reasignalos antes de eliminarlo.`,
            }
        }
        return { success: false, error: traducirErrorRol(error.code, error.message) }
    }
    return { success: true }
}

// ── Leer los permisos actuales de un rol (para el editor) ────────────────────
export async function obtenerPermisosRol(clave: string): Promise<RespuestaLista<PermisoPayload>> {
    const supabase = await createClient()

    // Resolver por clave: los UUID de semilla cambian entre entornos.
    const { data: rol } = await supabase.from('roles').select('id').eq('clave', clave).single()
    if (!rol) return { success: false, error: 'Rol no encontrado.' }

    const { data, error } = await supabase
        .from('permisos_acciones')
        .select('submodulos(href), acciones(clave)')
        .eq('id_rol', rol.id)

    if (error) return { success: false, error: error.message }

    // Agrupar acciones por href. Solo las 5 del editor (aprobar queda oculta — R4).
    const mapa = new Map<string, string[]>()
    for (const f of (data ?? []) as unknown as FilaPermisoCruda[]) {
        const href = f.submodulos?.href
        const claveAccion = f.acciones?.clave
        if (!href || !claveAccion) continue
        const lista = mapa.get(href) ?? []
        if (!lista.includes(claveAccion)) lista.push(claveAccion)
        mapa.set(href, lista)
    }

    const permisos: PermisoPayload[] = Array.from(mapa.entries()).map(([href, acciones]) => ({
        href,
        acciones: acciones.filter((a) =>
            (ACCIONES_EDITOR as string[]).includes(a)
        ) as AccionEditor[],
    }))

    return { success: true, data: permisos }
}

// ── Guardar permisos (R4: única vía la RPC) ──────────────────────────────────
export async function guardarPermisosRol(
    clave: string,
    permisos: PermisoPayload[]
): Promise<RespuestaAccion> {
    const supabase = await createClient()

    // La RPC es atómica y re-verifica es_administrador() por dentro
    // (SECURITY DEFINER). Nunca delete+insert directo.
    const { error } = await supabase.rpc('guardar_permisos_rol', {
        p_clave_rol: clave,
        p_permisos: permisos,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// ── Restablecer a semilla (R6: solo ese rol) ─────────────────────────────────
export async function restablecerPermisosRol(clave: string): Promise<RespuestaAccion> {
    const supabase = await createClient()

    // R6: vuelve a la semilla original de ESE rol (matriz 0.4 P6 B9). No borra
    // todo y no re-sembra el catálogo. Solo los 6 roles editables tienen semilla.
    const semilla = PERMISOS_SEMILLA[clave]
    if (!semilla) {
        return { success: false, error: 'Este rol no tiene semilla para restablecer.' }
    }

    // El MISMO RPC, con el snapshot como payload (un solo camino de escritura).
    const { error } = await supabase.rpc('guardar_permisos_rol', {
        p_clave_rol: clave,
        p_permisos: semilla,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
}
