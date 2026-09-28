// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — SISTEMA DE PLANTILLAS (Guía 2.1 · 27 Sep 2026)
// Espejo LITERAL de public.tipos_documento + plantillas_documento +
// plantillas_documento_versiones + impresiones_documento
// (GUIAS/23/docs/bd-plantillas.md §3).
// Los nombres snake_case son contrato con la BD: renombrar uno guarda el dato
// equivocado sin romper el build (CLAUDE.md, regla 4). La BD real manda.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Vocabulario cerrado (CHECK en BD: familia IN ('interno','valor')) ──────────
/** `interno` = acto interno (basta imagen) · `valor` = papel que sale de la empresa. */
export type FamiliaDocumento = 'interno' | 'valor'

// ── 1 · tipos_documento — el inventario vivo ──────────────────────────────────
export interface TipoDocumento {
    id: string
    /** ⭐ El VÍNCULO con los consumidores (`tipo="nota_compra"` literal). Inmutable y no reutilizable. */
    clave: string
    nombre: string
    familia: FamiliaDocumento
    se_firma: boolean
    /** Solo puede ser `true` en familia `valor` (CHECK de la BD). */
    audita_reimpresion: boolean
    descripcion: string | null
    es_activo: boolean
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
    /** Derivado por la SA (embed de la plantilla ACTIVA) — `null` = el tipo no tiene plantilla. */
    plantilla_version: number | null
}

// ── 2 · plantillas_documento — la plantilla ───────────────────────────────────
/** Una variable declarada del cuerpo. El motor valida el HTML contra este esquema. */
export interface VariablePlantilla {
    clave: string
    descripcion: string
}

export interface PlantillaDocumento {
    id: string
    id_tipo: string
    /** Embeds para la parrilla (display). */
    tipo_clave: string | null
    tipo_nombre: string | null
    familia: FamiliaDocumento | null
    nombre: string
    /** HTML con placeholders. Se sanea en un solo punto (P6). */
    cuerpo: string
    variables: VariablePlantilla[]
    /** ⭐ La asigna el TRIGGER `fn_plantillas_versionar()` — el código NUNCA la escribe. */
    version: number
    notas_version: string | null
    /** Nace `false`: activar exige haber previsualizado (R6). */
    es_activo: boolean
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
}

/**
 * ⭐ EL CONTRATO DEL REGISTRO `{tipo → plantilla}`.
 * Lo que devuelve `obtenerPlantillaActiva(clave)`: **solo lo necesario para pintar y auditar**.
 * `null` ⇒ no hay plantilla activa para ese tipo ⇒ el consumidor usa su **fallback en código**.
 */
export interface PlantillaActiva {
    clave: string
    id_plantilla: string
    version: number
    cuerpo: string
    variables: VariablePlantilla[]
}

// ── 3 · plantillas_documento_versiones — el historial (APPEND-ONLY) ───────────
export interface VersionPlantilla {
    id: string
    id_plantilla: string
    version: number
    cuerpo: string
    variables: VariablePlantilla[]
    notas_version: string | null
    creado_por: string | null
    created_at: string
}

// ── 4 · impresiones_documento — la auditoría (APPEND-ONLY · solo familia valor) ─
export interface ImpresionDocumento {
    id: string
    /** Textual, NO FK: la bitácora sobrevive a que el tipo se desactive. */
    clave: string
    id_plantilla: string | null
    version: number | null
    creado_por: string | null
    created_at: string
}

// ── Filtros (los 3 del PLAN §1.6) ─────────────────────────────────────────────
export interface FiltrosPlantillas {
    busqueda: string
    /** '' = todas las familias */
    familia: FamiliaDocumento | ''
    /** '' = todos */
    esActivo: '' | 'activos' | 'inactivos'
}

/** El inventario de tipos filtra por lo mismo (misma barra, misma forma). */
export type FiltrosTiposDocumento = FiltrosPlantillas

// ── Forma canónica de los formularios ─────────────────────────────────────────
export interface TipoDocumentoFormData {
    clave: string
    nombre: string
    familia: FamiliaDocumento
    se_firma: boolean
    audita_reimpresion: boolean
    descripcion: string
    es_activo: boolean
}

export interface PlantillaFormData {
    id_tipo: string
    nombre: string
    cuerpo: string
    variables: VariablePlantilla[]
    notas_version: string
    es_activo: boolean
}

export function tipoDocumentoFormDataVacia(): TipoDocumentoFormData {
    return {
        clave: '',
        nombre: '',
        familia: 'interno',
        se_firma: false,
        audita_reimpresion: false,
        descripcion: '',
        es_activo: true,
    }
}

export function tipoDocumentoAFormData(t: TipoDocumento): TipoDocumentoFormData {
    return {
        clave: t.clave,
        nombre: t.nombre,
        familia: t.familia,
        se_firma: t.se_firma,
        audita_reimpresion: t.audita_reimpresion,
        descripcion: t.descripcion ?? '',
        es_activo: t.es_activo,
    }
}

export function plantillaFormDataVacia(idTipo: string): PlantillaFormData {
    return {
        id_tipo: idTipo,
        nombre: '',
        cuerpo: '',
        variables: [],
        notas_version: '',
        es_activo: false,
    }
}

export function plantillaAFormData(p: PlantillaDocumento): PlantillaFormData {
    return {
        id_tipo: p.id_tipo,
        nombre: p.nombre,
        cuerpo: p.cuerpo,
        variables: p.variables ?? [],
        notas_version: p.notas_version ?? '',
        es_activo: p.es_activo,
    }
}

// ── Respuestas (patrón de la casa: cada dominio declara las suyas) ────────────
export interface RespuestaLista<T> {
    success: boolean
    error?: string
    data?: T[]
    total?: number
}

export interface RespuestaDato<T> {
    success: boolean
    error?: string
    data?: T
}

export interface RespuestaAccion {
    success: boolean
    error?: string
}
