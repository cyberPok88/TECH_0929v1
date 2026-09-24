// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — PROVEEDORES (Guía 1.1)
// Espejo LITERAL de public.proveedores (GUIAS/13/docs/bd-proveedores.md §3).
// Los nombres snake_case son contrato con la BD: renombrar uno guarda el dato
// equivocado sin romper el build (CLAUDE.md, regla 4).
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Vocabulario cerrado de la tabla (CHECKs en BD · MODELO_DATOS §7.2) ────────
export type TipoProveedor = 'formal' | 'informal' | 'eventual'
export type TerminosPago = 'contado' | 'credito'

// ── Fila del listado / ficha — lo que proyectan listar y obtener ──────────────
// regimen_descripcion llega aplanada desde el embed sat_regimenes_fiscales
// (la UI muestra el nombre del régimen, no el id).
export interface Proveedor {
    id: string
    codigo: string
    nombre_comercial: string
    razon_social: string | null
    tipo: TipoProveedor
    rfc: string | null
    id_regimen_fiscal: string | null
    regimen_descripcion: string | null
    telefono: string | null
    email: string | null
    nombre_contacto: string | null
    direccion: string | null
    colonia: string | null
    ciudad: string | null
    estado: string | null
    codigo_postal: string | null
    terminos_pago: TerminosPago
    dias_credito: number | null
    saldo_por_pagar: number
    notas: string | null
    es_activo: boolean
    es_archivado: boolean
    created_at: string
    updated_at: string
}

// ── Opción del selector de proveedor (contrato hacia 1.4 Compras / 1.6 Entradas) ─
export interface ProveedorOpcion {
    id: string
    codigo: string
    nombre_comercial: string
    rfc: string | null
}

// ── Estado derivado de la fila — vocabulario de la pantalla ───────────────────
// No es columna: se deriva de es_activo/es_archivado. archivado gana.
export type EstadoProveedor = 'activo' | 'inactivo' | 'archivado'

export function estadoDeProveedor(
    p: Pick<Proveedor, 'es_activo' | 'es_archivado'>
): EstadoProveedor {
    if (p.es_archivado) return 'archivado'
    return p.es_activo ? 'activo' : 'inactivo'
}

// El mapa estado → tono vive AQUÍ, no en Pildora (patrón 0.9 · Decisión 13).
export const TONO_ESTADO: Record<EstadoProveedor, TonoPildora> = {
    activo: 'exito',
    inactivo: 'neutro',
    archivado: 'advertencia',
}

export const TEXTO_ESTADO: Record<EstadoProveedor, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    archivado: 'Archivado',
}

// ── Tipo (formal/informal/eventual) → píldora del listado y de la ficha ───────
export const TONO_TIPO: Record<TipoProveedor, TonoPildora> = {
    formal: 'exito',
    informal: 'neutro',
    eventual: 'advertencia',
}

export const TEXTO_TIPO: Record<TipoProveedor, string> = {
    formal: 'Formal',
    informal: 'Informal',
    eventual: 'Eventual',
}

// ── Estado del filtro — tres posiciones (PLAN §4 #9 · usuario 03 Sep) ─────────
// 'activo' (default) = en catálogo vigente: es_archivado = false Y es_activo = true.
// Los desactivados (es_activo = false, sin archivar) se ven en 'todos' para poder
// reactivarlos desde el listado; 'archivados' es la papelera enfocada.
export type EstadoFiltroProveedor = 'activo' | 'archivados' | 'todos'

// ── Estado de la barra de filtros (lo posee el catálogo, lo pinta ProveedorFilters) ─
export interface FiltrosProveedor {
    busqueda: string
    /** '' = todos los tipos */
    tipo: TipoProveedor | ''
    estado: EstadoFiltroProveedor
}

// ── Forma canónica del formulario del modal (4 pestañas · ANATOMÍA §4) ─────────
// Valores crudos del formulario (RHF): opcionales como '' y dias_credito como
// string ('' = sin plazo). Los schemas de zod (validations/proveedores.ts) los
// transforman a string | undefined / number | null para la BD.
export interface ProveedorFormData {
    nombre_comercial: string
    razon_social: string
    tipo: TipoProveedor
    rfc: string
    id_regimen_fiscal: string
    telefono: string
    email: string
    nombre_contacto: string
    direccion: string
    colonia: string
    ciudad: string
    estado: string
    codigo_postal: string
    terminos_pago: TerminosPago
    dias_credito: string
    notas: string
    es_activo: boolean
}

/** Formulario vacío (alta). El codigo NUNCA se captura (autogenerado PROV-####). */
export function proveedorFormDataVacio(): ProveedorFormData {
    return {
        nombre_comercial: '',
        razon_social: '',
        tipo: 'formal',
        rfc: '',
        id_regimen_fiscal: '',
        telefono: '',
        email: '',
        nombre_contacto: '',
        direccion: '',
        colonia: '',
        ciudad: '',
        estado: '',
        codigo_postal: '',
        terminos_pago: 'contado',
        dias_credito: '',
        notas: '',
        es_activo: true,
    }
}

/** Proveedor → formulario (edición). codigo/created_at/updated_at NO viajan. */
export function proveedorAFormData(p: Proveedor): ProveedorFormData {
    return {
        nombre_comercial: p.nombre_comercial,
        razon_social: p.razon_social ?? '',
        tipo: p.tipo,
        rfc: p.rfc ?? '',
        id_regimen_fiscal: p.id_regimen_fiscal ?? '',
        telefono: p.telefono ?? '',
        email: p.email ?? '',
        nombre_contacto: p.nombre_contacto ?? '',
        direccion: p.direccion ?? '',
        colonia: p.colonia ?? '',
        ciudad: p.ciudad ?? '',
        estado: p.estado ?? '',
        codigo_postal: p.codigo_postal ?? '',
        terminos_pago: p.terminos_pago,
        dias_credito: p.dias_credito === null || p.dias_credito === 0 ? '' : String(p.dias_credito),
        notas: p.notas ?? '',
        es_activo: p.es_activo,
    }
}

// ── Respuestas tipadas de las Server Actions (nunca throw — patrón 0.9) ───────
export interface RespuestaLista<T> {
    success: boolean
    error?: string
    data?: T[]
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
