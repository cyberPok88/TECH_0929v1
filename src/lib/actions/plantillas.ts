// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — SISTEMA DE PLANTILLAS (Guía 2.1 · 27 Sep 2026)
// 'use server': obligatorio · retornan objetos tipados — NUNCA throw.
//   Tipos:      listarTiposDocumento · crearTipoDocumento · editarTipoDocumento ·
//               cambiarEstadoTipoDocumento
//   Plantillas: listarPlantillas · obtenerPlantilla · crearPlantilla ·
//               editarPlantilla · cambiarEstadoPlantilla
//   Versiones:  listarVersiones · restaurarVersion
//   Contratos:  obtenerPlantillaActiva  ← el registro `{clave → plantilla}` (lo consumen 1.4/1.6/1.7/1.8)
//               registrarImpresion       ← la auditoría del papel con valor
// ⚠️ `version` la escribe el TRIGGER fn_plantillas_versionar(): este archivo NUNCA la asigna.
// ⚠️ `tipos_documento` y `plantillas_documento` NO tienen política de DELETE: se desactivan.
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import { createClient } from '@/lib/supabase/server'
import {
    estadoSchema,
    plantillaCrearSchema,
    plantillaEditarSchema,
    restaurarVersionSchema,
    tipoDocumentoCrearSchema,
    tipoDocumentoEditarSchema,
} from '@/lib/validations/plantillas'
import type {
    PlantillaCrearInput,
    PlantillaEditarInput,
    TipoDocumentoCrearInput,
    TipoDocumentoEditarInput,
} from '@/lib/validations/plantillas'
import type {
    FamiliaDocumento,
    FiltrosPlantillas,
    FiltrosTiposDocumento,
    ImpresionDocumento,
    PlantillaActiva,
    PlantillaDocumento,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
    TipoDocumento,
    VariablePlantilla,
    VersionPlantilla,
} from '@/types/plantillas'

// ── Columnas (contrato literal con la BD) ─────────────────────────────────────
const COLUMNAS_TIPO = [
    'id', 'clave', 'nombre', 'familia', 'se_firma', 'audita_reimpresion',
    'descripcion', 'es_activo', 'creado_por', 'actualizado_por',
    'created_at', 'updated_at',
    // embed: la plantilla ACTIVA (el índice parcial garantiza que hay 0 o 1)
    'plantillas_documento(version)',
].join(',')

const COLUMNAS_PLANTILLA = [
    'id', 'id_tipo', 'nombre', 'cuerpo', 'variables', 'version', 'notas_version',
    'es_activo', 'creado_por', 'actualizado_por', 'created_at', 'updated_at',
    'tipos_documento(clave,nombre,familia)',
].join(',')

const COLUMNAS_VERSION = [
    'id', 'id_plantilla', 'version', 'cuerpo', 'variables', 'notas_version',
    'creado_por', 'created_at',
].join(',')

// ── Formas crudas de PostgREST ────────────────────────────────────────────────
interface FilaTipoCruda {
    id: string
    clave: string
    nombre: string
    familia: FamiliaDocumento
    se_firma: boolean
    audita_reimpresion: boolean
    descripcion: string | null
    es_activo: boolean
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
    plantillas_documento: { version: number }[] | null
}

interface FilaPlantillaCruda {
    id: string
    id_tipo: string
    nombre: string
    cuerpo: string
    variables: VariablePlantilla[] | null
    version: number
    notas_version: string | null
    es_activo: boolean
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
    tipos_documento: { clave: string; nombre: string; familia: FamiliaDocumento } | null
}

function aTipo(p: FilaTipoCruda): TipoDocumento {
    return {
        id: p.id,
        clave: p.clave,
        nombre: p.nombre,
        familia: p.familia,
        se_firma: p.se_firma,
        audita_reimpresion: p.audita_reimpresion,
        descripcion: p.descripcion,
        es_activo: p.es_activo,
        creado_por: p.creado_por,
        actualizado_por: p.actualizado_por,
        created_at: p.created_at,
        updated_at: p.updated_at,
        plantilla_version: p.plantillas_documento?.[0]?.version ?? null,
    }
}

function aPlantilla(p: FilaPlantillaCruda): PlantillaDocumento {
    return {
        id: p.id,
        id_tipo: p.id_tipo,
        tipo_clave: p.tipos_documento?.clave ?? null,
        tipo_nombre: p.tipos_documento?.nombre ?? null,
        familia: p.tipos_documento?.familia ?? null,
        nombre: p.nombre,
        cuerpo: p.cuerpo,
        variables: p.variables ?? [],
        version: p.version,
        notas_version: p.notas_version,
        es_activo: p.es_activo,
        creado_por: p.creado_por,
        actualizado_por: p.actualizado_por,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

function aNull(v: string): string | null {
    const t = v.trim()
    return t ? t : null
}

/** Limpia los comodines de PostgREST en una búsqueda de texto. */
function aBusqueda(v: string): string {
    return v.trim().replace(/[%_]/g, '')
}

/** Traduce el error de Postgres al mensaje que el usuario puede accionar. */
function traducirError(codigo: string | undefined, mensaje: string, contexto: 'tipo' | 'plantilla'): string {
    if (codigo === '23505') {
        return contexto === 'tipo'
            ? 'Ya existe un tipo de documento con esa clave.'
            : 'Ese tipo ya tiene una plantilla ACTIVA. Desactiva la actual primero.'
    }
    if (codigo === '23503') return 'El tipo de documento seleccionado ya no existe.'
    if (codigo === '23514') return 'Los datos incumplen una regla del sistema (revisa familia y auditoría).'
    if (codigo === '42501') return 'No tienes permiso para administrar plantillas.'
    return mensaje
}

async function sesionActiva(
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string } | { error: string }> {
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
    return { userId: sesion.user.id }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DE DOCUMENTO — el inventario vivo
// ═══════════════════════════════════════════════════════════════════════════════

export async function listarTiposDocumento(
    filtros: FiltrosTiposDocumento
): Promise<RespuestaLista<TipoDocumento>> {
    const supabase = await createClient()

    let query = supabase.from('tipos_documento').select(COLUMNAS_TIPO)

    if (filtros.familia) query = query.eq('familia', filtros.familia)
    if (filtros.esActivo === 'activos') query = query.eq('es_activo', true)
    if (filtros.esActivo === 'inactivos') query = query.eq('es_activo', false)

    const busqueda = aBusqueda(filtros.busqueda)
    if (busqueda) query = query.or(`clave.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%`)

    // Paginación de CLIENTE (PLAN §4): 8 filas — se traen todas y la tabla pagina.
    const { data, error } = await query.order('clave', { ascending: true })

    if (error) return { success: false, error: error.message }
    const tipos = ((data ?? []) as unknown as FilaTipoCruda[]).map(aTipo)
    return { success: true, data: tipos, total: tipos.length }
}

export async function crearTipoDocumento(datos: TipoDocumentoCrearInput): Promise<RespuestaAccion> {
    const parsed = tipoDocumentoCrearSchema.safeParse(datos)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { error } = await supabase.from('tipos_documento').insert({
        clave: parsed.data.clave,
        nombre: parsed.data.nombre,
        familia: parsed.data.familia,
        se_firma: parsed.data.se_firma,
        audita_reimpresion: parsed.data.audita_reimpresion,
        descripcion: aNull(parsed.data.descripcion),
        es_activo: parsed.data.es_activo,
        creado_por: sesion.userId,
        actualizado_por: sesion.userId,
    })

    if (error) return { success: false, error: traducirError(error.code, error.message, 'tipo') }
    return { success: true }
}

export async function editarTipoDocumento(
    id: string,
    datos: TipoDocumentoEditarInput
): Promise<RespuestaAccion> {
    const parsed = tipoDocumentoEditarSchema.safeParse(datos)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    // ⭐ R1 — la `clave` NO viaja: es el vínculo con los consumidores y es inmutable.
    const { error } = await supabase
        .from('tipos_documento')
        .update({
            nombre: parsed.data.nombre,
            familia: parsed.data.familia,
            se_firma: parsed.data.se_firma,
            audita_reimpresion: parsed.data.audita_reimpresion,
            descripcion: aNull(parsed.data.descripcion),
            es_activo: parsed.data.es_activo,
            actualizado_por: sesion.userId,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirError(error.code, error.message, 'tipo') }
    return { success: true }
}

export async function cambiarEstadoTipoDocumento(id: string, activo: boolean): Promise<RespuestaAccion> {
    const parsed = estadoSchema.safeParse({ id, activo })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { error } = await supabase
        .from('tipos_documento')
        .update({ es_activo: activo, actualizado_por: sesion.userId })
        .eq('id', id)

    if (error) return { success: false, error: traducirError(error.code, error.message, 'tipo') }
    return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS
// ═══════════════════════════════════════════════════════════════════════════════

export async function listarPlantillas(
    filtros: FiltrosPlantillas
): Promise<RespuestaLista<PlantillaDocumento>> {
    const supabase = await createClient()

    let query = supabase.from('plantillas_documento').select(COLUMNAS_PLANTILLA)

    if (filtros.esActivo === 'activos') query = query.eq('es_activo', true)
    if (filtros.esActivo === 'inactivos') query = query.eq('es_activo', false)

    const busqueda = aBusqueda(filtros.busqueda)
    if (busqueda) query = query.or(`nombre.ilike.%${busqueda}%`)

    // Paginación de CLIENTE (PLAN §4).
    const { data, error } = await query
        .order('es_activo', { ascending: false })
        .order('updated_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    let plantillas = ((data ?? []) as unknown as FilaPlantillaCruda[]).map(aPlantilla)
    // El filtro por familia vive en el TIPO (embed): se aplica después de aplanar.
    if (filtros.familia) plantillas = plantillas.filter((p) => p.familia === filtros.familia)

    return { success: true, data: plantillas, total: plantillas.length }
}

export async function obtenerPlantilla(id: string): Promise<RespuestaDato<PlantillaDocumento>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('plantillas_documento')
        .select(COLUMNAS_PLANTILLA)
        .eq('id', id)
        .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'La plantilla no existe o no tienes acceso.' }

    return { success: true, data: aPlantilla(data as unknown as FilaPlantillaCruda) }
}

export async function crearPlantilla(datos: PlantillaCrearInput): Promise<RespuestaAccion> {
    const parsed = plantillaCrearSchema.safeParse(datos)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    // ⚠️ Nace INACTIVA si el formulario no pide lo contrario — y activar exige previsualizar (R6).
    const { error } = await supabase.from('plantillas_documento').insert({
        id_tipo: parsed.data.id_tipo,
        nombre: parsed.data.nombre,
        cuerpo: parsed.data.cuerpo,
        variables: parsed.data.variables,
        notas_version: aNull(parsed.data.notas_version),
        es_activo: parsed.data.es_activo,
        creado_por: sesion.userId,
        actualizado_por: sesion.userId,
    })

    if (error) return { success: false, error: traducirError(error.code, error.message, 'plantilla') }
    return { success: true }
}

export async function editarPlantilla(
    id: string,
    datos: PlantillaEditarInput
): Promise<RespuestaAccion> {
    const parsed = plantillaEditarSchema.safeParse(datos)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    // ⚠️ SIN `version`: la asigna el trigger `fn_plantillas_versionar()` al detectar el cambio
    //    de `cuerpo`/`variables`, y archiva el estado previo en el historial.
    const { error } = await supabase
        .from('plantillas_documento')
        .update({
            nombre: parsed.data.nombre,
            cuerpo: parsed.data.cuerpo,
            variables: parsed.data.variables,
            notas_version: aNull(parsed.data.notas_version),
            es_activo: parsed.data.es_activo,
            actualizado_por: sesion.userId,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirError(error.code, error.message, 'plantilla') }
    return { success: true }
}

export async function cambiarEstadoPlantilla(id: string, activo: boolean): Promise<RespuestaAccion> {
    const parsed = estadoSchema.safeParse({ id, activo })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    // El índice parcial `uq_plantilla_activa_por_tipo` es quien rechaza una 2ª activa (23505).
    const { error } = await supabase
        .from('plantillas_documento')
        .update({ es_activo: activo, actualizado_por: sesion.userId })
        .eq('id', id)

    if (error) return { success: false, error: traducirError(error.code, error.message, 'plantilla') }
    return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONES — historial (APPEND-ONLY: la SA solo lee y restaura)
// ═══════════════════════════════════════════════════════════════════════════════

export async function listarVersiones(idPlantilla: string): Promise<RespuestaLista<VersionPlantilla>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('plantillas_documento_versiones')
        .select(COLUMNAS_VERSION)
        .eq('id_plantilla', idPlantilla)
        .order('version', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as unknown as VersionPlantilla[] }
}

/**
 * Restaurar = copiar el cuerpo/variables de una versión anterior a la plantilla.
 * NO borra nada: el trigger archiva el estado actual y sube la versión del mismo modo
 * que una edición — así el historial crece también al restaurar.
 */
export async function restaurarVersion(
    id: string,
    version: number
): Promise<RespuestaAccion> {
    const parsed = restaurarVersionSchema.safeParse({ id, version })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: historica, error: errHist } = await supabase
        .from('plantillas_documento_versiones')
        .select('cuerpo, variables')
        .eq('id_plantilla', parsed.data.id)
        .eq('version', parsed.data.version)
        .maybeSingle()

    if (errHist) return { success: false, error: errHist.message }
    if (!historica) return { success: false, error: 'Esa versión no está en el historial.' }

    // El `notas_version` deja traza de que esto fue una restauración, no una edición a mano.
    const { error } = await supabase
        .from('plantillas_documento')
        .update({
            cuerpo: historica.cuerpo,
            variables: historica.variables,
            notas_version: `Restaurada la versión ${parsed.data.version}`,
            actualizado_por: sesion.userId,
        })
        .eq('id', parsed.data.id)

    if (error) return { success: false, error: traducirError(error.code, error.message, 'plantilla') }
    return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOS 2 CONTRATOS QUE CRUZAN LA FRONTERA DEL MÓDULO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⭐ EL REGISTRO `{clave → plantilla}`.
 *
 * Devuelve la plantilla ACTIVA de un tipo, o **`null`** cuando el tipo no tiene ninguna.
 * `null` NO es un error: es el caso del tipo que aún vive como componente en código, y el
 * consumidor debe caer a su **fallback** (decisión 9 de la Parte 0).
 *
 * Lo consumen las guías 1.4 · 1.6 · 1.7 · 1.8 a través de `lib/plantillas/registro.ts` (P6).
 */
export async function obtenerPlantillaActiva(clave: string): Promise<PlantillaActiva | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('plantillas_documento')
        .select('id, version, cuerpo, variables, tipos_documento!inner(clave, es_activo)')
        .eq('tipos_documento.clave', clave)
        .eq('es_activo', true)
        .maybeSingle()

    if (error || !data) return null

    const fila = data as unknown as {
        id: string
        version: number
        cuerpo: string
        variables: VariablePlantilla[] | null
        tipos_documento: { clave: string; es_activo: boolean }
    }
    if (!fila.tipos_documento.es_activo) return null

    return {
        clave: fila.tipos_documento.clave,
        id_plantilla: fila.id,
        version: fila.version,
        cuerpo: fila.cuerpo,
        variables: fila.variables ?? [],
    }
}

/**
 * ⭐ LA AUDITORÍA DEL PAPEL CON VALOR.
 *
 * Registra quién reimprimió qué versión. Solo tiene efecto en tipos de familia `valor`:
 * un trigger de la BD **rechaza** auditar un tipo `interno` y exige el usuario, así que
 * esta acción no necesita repetir esa regla — la BD es la que manda.
 *
 * `creado_por` viaja explícito porque la política RLS es `creado_por = auth.uid()`.
 */
export async function registrarImpresion(
    clave: string,
    version: number | null
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { error } = await supabase.from('impresiones_documento').insert({
        clave,
        version,
        creado_por: sesion.userId,
    })

    // Un fallo de auditoría NO debe impedir imprimir: se informa y el papel sale igual.
    if (error) return { success: false, error: error.message }
    return { success: true }
}

/** Historial de impresiones de un tipo (superficie 8 · tab «Auditoría»). */
export async function listarImpresiones(clave: string): Promise<RespuestaLista<ImpresionDocumento>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('impresiones_documento')
        .select('id, clave, id_plantilla, version, creado_por, created_at')
        .eq('clave', clave)
        .order('created_at', { ascending: false })
        .limit(200)

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as unknown as ImpresionDocumento[] }
}
