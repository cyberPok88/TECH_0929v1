// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — PROVEEDORES (Guía 1.1)
// 'use server' en la línea 1: obligatorio, sin comentarios ni espacios antes.
// Retornan objetos tipados — NUNCA throw (patrón 0.9 · CONVENCIONES §5).
//
//   listarProveedores (filtros) · obtenerProveedor (ficha/deep link)
//   crearProveedor · editarProveedor · cambiarEstadoProveedor
//   archivarProveedor (soft-delete · permiso eliminar = archivar)
//   listarProveedoresActivos (contrato → 1.4 Compras / 1.6 Entradas)
//   crearProveedorRapido (contrato → 1.6 Entradas · Flujo 01 §10.3.1)
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import { createClient } from '@/lib/supabase/server'
import {
    proveedorRapidoSchema,
    proveedorSchema,
} from '@/lib/validations/proveedores'
import type { ProveedorInput, ProveedorRapidoInput } from '@/lib/validations/proveedores'
import type {
    FiltrosProveedor,
    Proveedor,
    ProveedorOpcion,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
} from '@/types/proveedores'

// Forma cruda del embed PostgREST: proveedores + sat_regimenes_fiscales(descripcion).
interface FilaProveedorCruda {
    id: string
    codigo: string
    nombre_comercial: string
    razon_social: string | null
    tipo: 'formal' | 'informal' | 'eventual'
    rfc: string | null
    id_regimen_fiscal: string | null
    telefono: string | null
    email: string | null
    nombre_contacto: string | null
    direccion: string | null
    colonia: string | null
    ciudad: string | null
    estado: string | null
    codigo_postal: string | null
    terminos_pago: 'contado' | 'credito'
    dias_credito: number | null
    saldo_por_pagar: number
    notas: string | null
    es_activo: boolean
    es_archivado: boolean
    created_at: string
    updated_at: string
    sat_regimenes_fiscales: { descripcion: string } | null
}

const COLUMNAS = [
    'id',
    'codigo',
    'nombre_comercial',
    'razon_social',
    'tipo',
    'rfc',
    'id_regimen_fiscal',
    'telefono',
    'email',
    'nombre_contacto',
    'direccion',
    'colonia',
    'ciudad',
    'estado',
    'codigo_postal',
    'terminos_pago',
    'dias_credito',
    'saldo_por_pagar',
    'notas',
    'es_activo',
    'es_archivado',
    'created_at',
    'updated_at',
    'sat_regimenes_fiscales(descripcion)',
].join(',')

function aFila(p: FilaProveedorCruda): Proveedor {
    return {
        id: p.id,
        codigo: p.codigo,
        nombre_comercial: p.nombre_comercial,
        razon_social: p.razon_social,
        tipo: p.tipo,
        rfc: p.rfc,
        id_regimen_fiscal: p.id_regimen_fiscal,
        regimen_descripcion: p.sat_regimenes_fiscales?.descripcion ?? null,
        telefono: p.telefono,
        email: p.email,
        nombre_contacto: p.nombre_contacto,
        direccion: p.direccion,
        colonia: p.colonia,
        ciudad: p.ciudad,
        estado: p.estado,
        codigo_postal: p.codigo_postal,
        terminos_pago: p.terminos_pago,
        dias_credito: p.dias_credito,
        saldo_por_pagar: p.saldo_por_pagar,
        notas: p.notas,
        es_activo: p.es_activo,
        es_archivado: p.es_archivado,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

/** '' del formulario → null de BD (columna nullable). */
function aNull(v: string): string | null {
    const t = v.trim()
    return t ? t : null
}

/** RFC normalizado en mayúsculas (o null). */
function aRfc(v: string): string | null {
    const t = v.trim().toUpperCase()
    return t ? t : null
}

/** Plazo: '' → null; entero > 0 validado ya por el schema → número. */
function aNum(v: string): number | null {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isInteger(n) && n > 0 ? n : null
}

function traducirErrorProveedor(codigo: string | undefined, mensaje: string): string {
    if (codigo === '23505') return 'Ya existe un registro con ese RFC o código.'
    if (codigo === '23503') return 'El régimen fiscal seleccionado no existe.'
    if (codigo === '42501') return 'No tienes permiso para realizar esta acción.'
    return mensaje
}

// ── Listar proveedores (filtros del listado · PLAN §4) ───────────────────────
export async function listarProveedores(
    filtros: FiltrosProveedor
): Promise<RespuestaLista<Proveedor>> {
    const supabase = await createClient()

    let query = supabase.from('proveedores').select(COLUMNAS)

    // Estado (tres posiciones · PLAN §4 #9): 'activo' es el default del catálogo
    // vigente (no archivado Y activo); los inactivos viven en 'todos'.
    if (filtros.estado === 'activo') {
        query = query.eq('es_archivado', false).eq('es_activo', true)
    } else if (filtros.estado === 'archivados') {
        query = query.eq('es_archivado', true)
    }
    // 'todos' → sin filtro de estado.

    if (filtros.tipo) query = query.eq('tipo', filtros.tipo)

    const busqueda = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (busqueda) {
        query = query.or(
            `nombre_comercial.ilike.%${busqueda}%,rfc.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%`
        )
    }

    const { data, error } = await query.order('nombre_comercial', { ascending: true })
    if (error) return { success: false, error: error.message }

    const proveedores = ((data ?? []) as unknown as FilaProveedorCruda[]).map(aFila)
    return { success: true, data: proveedores }
}

// ── Obtener uno (ficha · deep link ?proveedor={id} · contrato mapa §3) ────────
export async function obtenerProveedor(id: string): Promise<RespuestaDato<Proveedor>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('proveedores')
        .select(COLUMNAS)
        .eq('id', id)
        .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'El proveedor no existe.' }

    return { success: true, data: aFila(data as unknown as FilaProveedorCruda) }
}

// ── Crear proveedor (codigo autogenerado PROV-#### · MAPA §5 #4) ──────────────
export async function crearProveedor(input: ProveedorInput): Promise<RespuestaAccion> {
    const parsed = proveedorSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    // Folio: la semilla consecutivos('proveedor','PROV',4) la aplicó la Parte 1
    // (docs/bd-proveedores §0 · g13_p1_b3). generar_folio() es SECURITY DEFINER
    // con EXECUTE para authenticated (verificado en BD 03 Sep).
    const { data: codigo, error: errFolio } = await supabase.rpc('generar_folio', {
        p_tipo: 'proveedor',
    })
    if (errFolio || !codigo) {
        return {
            success: false,
            error: errFolio?.message ?? 'No se pudo generar el código del proveedor.',
        }
    }

    const { error } = await supabase.from('proveedores').insert({
        codigo,
        nombre_comercial: d.nombre_comercial,
        razon_social: aNull(d.razon_social),
        tipo: d.tipo,
        rfc: aRfc(d.rfc),
        id_regimen_fiscal: aNull(d.id_regimen_fiscal),
        telefono: aNull(d.telefono),
        email: aNull(d.email),
        nombre_contacto: aNull(d.nombre_contacto),
        direccion: aNull(d.direccion),
        colonia: aNull(d.colonia),
        ciudad: aNull(d.ciudad),
        estado: aNull(d.estado),
        codigo_postal: aNull(d.codigo_postal),
        terminos_pago: d.terminos_pago,
        // R5 — con 'contado' nunca se guarda plazo (aunque el form haya digitado algo).
        dias_credito: d.terminos_pago === 'credito' ? aNum(d.dias_credito) : null,
        notas: aNull(d.notas),
        es_activo: d.es_activo,
    })

    if (error) return { success: false, error: traducirErrorProveedor(error.code, error.message) }
    return { success: true }
}

// ── Editar proveedor (codigo es inmutable: no participa del UPDATE) ──────────
export async function editarProveedor(
    id: string,
    input: ProveedorInput
): Promise<RespuestaAccion> {
    const parsed = proveedorSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { error } = await supabase
        .from('proveedores')
        .update({
            nombre_comercial: d.nombre_comercial,
            razon_social: aNull(d.razon_social),
            tipo: d.tipo,
            rfc: aRfc(d.rfc),
            id_regimen_fiscal: aNull(d.id_regimen_fiscal),
            telefono: aNull(d.telefono),
            email: aNull(d.email),
            nombre_contacto: aNull(d.nombre_contacto),
            direccion: aNull(d.direccion),
            colonia: aNull(d.colonia),
            ciudad: aNull(d.ciudad),
            estado: aNull(d.estado),
            codigo_postal: aNull(d.codigo_postal),
            terminos_pago: d.terminos_pago,
            dias_credito: d.terminos_pago === 'credito' ? aNum(d.dias_credito) : null,
            notas: aNull(d.notas),
            es_activo: d.es_activo,
            actualizado_por: sesion.user.id,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorProveedor(error.code, error.message) }
    return { success: true }
}

// ── Activar / Desactivar (reversible · permiso editar) ───────────────────────
export async function cambiarEstadoProveedor(
    id: string,
    esActivo: boolean
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { error } = await supabase
        .from('proveedores')
        .update({ es_activo: esActivo, actualizado_por: sesion.user.id })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorProveedor(error.code, error.message) }
    return { success: true }
}

// ── Archivar / Reactivar (soft-delete · MAPA §5 #6 · R7) ──────────────────────
// Archivar = retiro lógico: es_archivado = true Y es_activo = false (deja de
// aparecer en el catálogo vigente). Reactivar restaura ambos (vuelve activo).
export async function archivarProveedor(
    id: string,
    archivar: boolean
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const patch = archivar
        ? { es_archivado: true, es_activo: false, actualizado_por: sesion.user.id }
        : { es_archivado: false, es_activo: true, actualizado_por: sesion.user.id }

    const { error } = await supabase.from('proveedores').update(patch).eq('id', id)
    if (error) return { success: false, error: traducirErrorProveedor(error.code, error.message) }
    return { success: true }
}

// ── Opciones para selectores (contrato → 1.4 Compras · 1.6 Entradas) ─────────
export async function listarProveedoresActivos(): Promise<RespuestaLista<ProveedorOpcion>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('proveedores')
        .select('id, codigo, nombre_comercial, rfc')
        .eq('es_archivado', false)
        .eq('es_activo', true)
        .order('nombre_comercial', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as ProveedorOpcion[] }
}

// ── Alta rápida (contrato → 1.6 Entradas · Flujo 01 §10.3.1 · R10) ────────────
// Captura mínima: solo nombre_comercial; tipo default 'formal' (columna con
// default en BD). El enriquecimiento lo hace el CRUD completo después.
export async function crearProveedorRapido(
    input: ProveedorRapidoInput
): Promise<RespuestaDato<{ id: string; codigo: string }>> {
    const parsed = proveedorRapidoSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { data: codigo, error: errFolio } = await supabase.rpc('generar_folio', {
        p_tipo: 'proveedor',
    })
    if (errFolio || !codigo) {
        return {
            success: false,
            error: errFolio?.message ?? 'No se pudo generar el código del proveedor.',
        }
    }

    const { data: fila, error } = await supabase
        .from('proveedores')
        .insert({
            codigo,
            nombre_comercial: parsed.data.nombre_comercial,
            tipo: 'formal',
            es_activo: true,
        })
        .select('id, codigo')
        .single()

    if (error) return { success: false, error: traducirErrorProveedor(error.code, error.message) }
    if (!fila) return { success: false, error: 'No se pudo crear el proveedor.' }

    return { success: true, data: { id: fila.id, codigo: fila.codigo } }
}
