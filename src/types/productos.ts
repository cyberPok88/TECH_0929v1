// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — PRODUCTOS (Guía 1.2)
// Espejo LITERAL de public.productos (GUIAS/14/docs/bd-productos.md §1.1 · b2).
// Los nombres snake_case son contrato con la BD: renombrar uno guarda el dato
// equivocado sin romper el build (CLAUDE.md, regla 4).
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Atributos técnicos variables (D16) ─────────────────────────────────────────
// Valores por producto (JSONB validado contra esquema_atributos de su categoría).
export type ValorAtributo = string | number | boolean | null
export type AtributosProducto = Record<string, ValorAtributo>

// ── Fila del listado / ficha — lo que proyectan listar y obtener ───────────────
// Los campos de display (categoria_nombre/marca_nombre) llegan aplanados desde los
// joins de la Server Action (la UI muestra nombres, no ids).
export interface Producto {
    id: string
    sku: string
    codigo_barras: string | null
    nombre: string
    descripcion: string | null
    marca_fabricante: string | null
    id_marca: string | null
    marca_nombre: string | null
    id_categoria: string | null
    categoria_nombre: string | null
    unidad_nombre: string | null
    impuesto_nombre: string | null
    ubicacion_texto: string | null
    sat_prod_descripcion: string | null
    sat_unid_nombre: string | null
    id_unidad_medida: string
    id_impuesto: string
    atributos: AtributosProducto
    precio_base: number
    precio_minimo: number | null
    costo_promedio: number
    stock_actual: number
    stock_minimo: number
    id_ubicacion_default: string | null
    maneja_numero_serie: boolean
    requiere_revision: boolean
    pendiente_enriquecimiento: boolean
    id_clave_prod_serv_sat: string | null
    id_clave_unidad_sat: string | null
    imagen_url: string | null
    notas: string | null
    es_activo: boolean
    es_archivado: boolean
    created_at: string
    updated_at: string
    creado_por: string | null
    actualizado_por: string | null
}

// ── Estado derivado de la fila (no es columna) — archivado gana ───────────────
export type EstadoProducto = 'activo' | 'inactivo' | 'archivado'

export function estadoDeProducto(
    p: Pick<Producto, 'es_activo' | 'es_archivado'>
): EstadoProducto {
    if (p.es_archivado) return 'archivado'
    return p.es_activo ? 'activo' : 'inactivo'
}

export const TONO_ESTADO_PRODUCTO: Record<EstadoProducto, TonoPildora> = {
    activo: 'exito',
    inactivo: 'neutro',
    archivado: 'advertencia',
}

export const TEXTO_ESTADO_PRODUCTO: Record<EstadoProducto, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    archivado: 'Archivado',
}

// ── Estado del filtro — tres posiciones + toggle de pendientes ────────────────
export type EstadoFiltroProducto = 'activo' | 'archivados' | 'todos'

export interface ProductoFiltros {
    busqueda: string
    /** '' = todas las categorías (la cascada raíz→sub la decide la UI) */
    id_categoria: string
    /** '' = todas las marcas */
    id_marca: string
    estado: EstadoFiltroProducto
    /** Solo pendiente_enriquecimiento = true */
    solo_pendientes: boolean
}

// ── Forma cruda del formulario (RHF) — opcionales como '' y montos como string ──
// Los schemas de zod (validations/productos.ts) validan; la conversión a la BD la
// hacen las Server Actions (patrón 1.1). Los atributos dinámicos viajan como
// Record<string,string> (todo input crudo) y se convierten por el tipo del esquema.
export interface ProductoFormData {
    nombre: string
    descripcion: string
    codigo_barras: string
    id_categoria: string
    id_marca: string
    id_unidad_medida: string
    id_impuesto: string
    precio_base: string
    precio_minimo: string
    stock_minimo: string
    id_ubicacion_default: string
    requiere_revision: boolean
    maneja_numero_serie: boolean
    es_activo: boolean
    id_clave_prod_serv_sat: string
    id_clave_unidad_sat: string
    imagen_url: string
    notas: string
    /** Claves = claves del esquema_atributos de la categoría elegida */
    atributos: Record<string, string>
}

/** Formulario vacío (alta). sku NUNCA se captura (autogenerado P-######). */
export function productoFormDataVacio(): ProductoFormData {
    return {
        nombre: '',
        descripcion: '',
        codigo_barras: '',
        id_categoria: '',
        id_marca: '',
        id_unidad_medida: '',
        id_impuesto: '',
        precio_base: '',
        precio_minimo: '',
        stock_minimo: '',
        id_ubicacion_default: '',
        requiere_revision: true,
        maneja_numero_serie: false,
        es_activo: true,
        id_clave_prod_serv_sat: '',
        id_clave_unidad_sat: '',
        imagen_url: '',
        notas: '',
        atributos: {},
    }
}

// ── Opción del selector de producto (contrato hacia 1.4–1.8 / sustitutos) ──────
export interface ProductoOpcion {
    id: string
    sku: string
    nombre: string
}

// ── Sustituto en la lista de la ficha ──────────────────────────────────────────
export type ProductoSustituto = ProductoOpcion

// ── Clave SAT (buscador del formulario · prop tipo) ────────────────────────────
export interface ClaveSAT {
    id: string
    clave: string
    descripcion: string
    nombre?: string
}

// ── Alta rápida (contrato hacia 1.6 Entradas — flujo-entrada-campos §2.3.3) ────
export interface ProductoRapidoData {
    nombre: string
    id_categoria?: string
    id_marca?: string
    id_unidad_medida: string
    id_impuesto: string
    atributos?: AtributosProducto
    codigo_barras?: string | null
    requiere_revision?: boolean
    maneja_numero_serie?: boolean
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
