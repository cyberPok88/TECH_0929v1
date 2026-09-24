// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — INVENTARIO (Guía 1.5 · 17 Sep 2026)
// Espejo LITERAL de public.lotes + movimientos_inventario + conteos_inventario +
// renglones_conteo (GUIAS/17/docs/bd-inventario.md §2 · columnas reales).
// Los nombres snake_case son contrato con la BD: renombrar uno guarda el dato
// equivocado sin romper el build (CLAUDE.md, regla 4). La BD real manda.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Vocabulario cerrado (CHECKs en BD · mapa/PLAN 17 Sep) ──────────────────────
/** Los 6 del MODELO §7.6 — cantidad con signo según tipo. */
export type TipoMovimiento =
    | 'entrada'
    | 'salida'
    | 'ajuste_positivo'
    | 'ajuste_negativo'
    | 'devolucion_cliente'
    | 'devolucion_proveedor'

/** Origen polimórfico reconciliado — SIN 'lotes' V1 ni 'compras' V1. */
export type OrigenMovimiento =
    | 'lote' // entrada de 1.6 atada a su lote (origen_id = id_lote)
    | 'entradas' // documento de Entradas 1.6 (cuando no haya lote aún)
    | 'venta' // salida por Ventas 1.8
    | 'inventario_fisico' // ajuste ± del conteo
    | 'ajuste_manual' // salida manual de 1.5 (merma tardía / corrección)
    | 'devolucion'

/** Motivo de la salida manual (FLUJO_01 §5.1/§6.1 + corrección inversa). */
export type MotivoSalidaManual =
    | 'merma_tardia'
    | 'correccion_inversa'
    | 'otro'

export type EstadoConteo = 'borrador' | 'aplicado' | 'cancelado'

// ── Lote de inventario (simple · lo puebla Entradas 1.6 al confirmar el alta) ──
export interface LoteInventario {
    id: string
    id_producto: string
    producto_nombre: string | null
    producto_sku: string | null
    cantidad_original: number
    cantidad_disponible: number
    costo_unitario: number | null
    fecha_entrada: string
    origen_tabla: string
    origen_id: string | null
    id_ubicacion: string | null
    ubicacion_nombre: string | null
    notas: string | null
    creado_por: string | null
    created_at: string
}

// ── Movimiento del libro (append-only — fila del kardex) ───────────────────────
export interface MovimientoInventario {
    id: string
    id_producto: string
    producto_nombre: string | null
    producto_sku: string | null
    id_lote: string | null
    tipo_movimiento: TipoMovimiento
    cantidad: number
    stock_anterior: number
    stock_resultante: number
    costo_unitario: number | null
    origen_tabla: OrigenMovimiento | null
    origen_id: string | null
    numero_serie: string | null
    motivo: string | null
    created_at: string
    creado_por: string | null
    creador_nombre: string | null
}

// ── Existencia por SKU (derivada: Σ lotes disponibles / stock_actual) ──────────
export interface ExistenciaProducto {
    id_producto: string
    sku: string
    nombre: string
    id_categoria: string | null
    categoria_nombre: string | null
    id_marca: string | null
    marca_nombre: string | null
    stock_actual: number
    stock_minimo: number
    id_ubicacion_default: string | null
    ubicacion_nombre: string | null
    maneja_numero_serie: boolean
    /** Comparación contra stock_minimo — la calcula la SA (ok | bajo_minimo | sin_stock). */
    estado_existencia: 'ok' | 'bajo_minimo' | 'sin_stock'
    total_lotes: number
}

// ── Conteo de inventario físico (documento borrador → aplicar → ajustes ±) ─────
export interface ConteoInventario {
    id: string
    fecha_conteo: string
    id_ubicacion: string
    ubicacion_nombre: string | null
    estado: EstadoConteo
    notas: string | null
    creado_por: string | null
    creador_nombre: string | null
    created_at: string
    total_renglones: number
}

export interface RenglonConteo {
    id: string
    id_conteo: string
    id_producto: string
    producto_nombre: string | null
    producto_sku: string | null
    cantidad_contada: number
    /** Stock del sistema al aplicar (lo calcula la SA para el ajuste ±). */
    stock_sistema: number | null
}

export interface ConteoInventarioDetalle extends ConteoInventario {
    renglones: RenglonConteo[]
}

// ── Forma canónica de los formularios (opcionales viajan como '') ──────────────
export interface SalidaManualFormData {
    id_producto: string
    cantidad: string
    motivo: MotivoSalidaManual
    numero_serie: string
    notas: string
}

export interface ConteoFormData {
    fecha_conteo: string
    id_ubicacion: string
    notas: string
    renglones: RenglonConteoForm[]
}

export interface RenglonConteoForm {
    id: string // '' = nueva
    id_producto: string
    cantidad_contada: string
}

export function conteoAFormData(c: ConteoInventarioDetalle): ConteoFormData {
    return {
        fecha_conteo: c.fecha_conteo,
        id_ubicacion: c.id_ubicacion,
        notas: c.notas ?? '',
        renglones: c.renglones.map((r) => ({
            id: r.id,
            id_producto: r.id_producto,
            cantidad_contada: String(r.cantidad_contada),
        })),
    }
}

// ── Filtros de listados ─────────────────────────────────────────────────────────
export interface FiltrosExistencias {
    busqueda: string
    id_categoria: string
    id_marca: string
    /** '' = todos · 'ok'/'bajo_minimo'/'sin_stock' según estado derivado. */
    estado: '' | 'ok' | 'bajo_minimo' | 'sin_stock'
}

export interface FiltrosConteos {
    estado: '' | EstadoConteo
    fecha_desde: string
    fecha_hasta: string
}

// ── Display — vocabulario de la pantalla ───────────────────────────────────────
export const TEXTO_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
    entrada: 'Entrada',
    salida: 'Salida',
    ajuste_positivo: 'Ajuste +',
    ajuste_negativo: 'Ajuste −',
    devolucion_cliente: 'Dev. cliente',
    devolucion_proveedor: 'Dev. proveedor',
}

export const TONO_TIPO_MOVIMIENTO: Record<TipoMovimiento, TonoPildora> = {
    entrada: 'exito',
    salida: 'peligro',
    ajuste_positivo: 'info',
    ajuste_negativo: 'advertencia',
    devolucion_cliente: 'info',
    devolucion_proveedor: 'info',
}

export const TEXTO_ORIGEN: Record<OrigenMovimiento, string> = {
    lote: 'Lote',
    entradas: 'Entrada (1.6)',
    venta: 'Venta',
    inventario_fisico: 'Inventario físico',
    ajuste_manual: 'Ajuste manual',
    devolucion: 'Devolución',
}

export const TEXTO_MOTIVO_SALIDA: Record<MotivoSalidaManual, string> = {
    merma_tardia: 'Merma tardía (falla no detectada en revisión)',
    correccion_inversa: 'Corrección de un error de entrada',
    otro: 'Otro',
}

export const OPCIONES_MOTIVO_SALIDA: MotivoSalidaManual[] = [
    'merma_tardia',
    'correccion_inversa',
    'otro',
]

export const TEXTO_ESTADO_CONSUMO: Record<'ok' | 'bajo_minimo' | 'sin_stock', string> = {
    ok: 'Ok',
    bajo_minimo: 'Bajo mínimo',
    sin_stock: 'Sin stock',
}

export const TONO_ESTADO_CONSUMO: Record<'ok' | 'bajo_minimo' | 'sin_stock', TonoPildora> = {
    ok: 'exito',
    bajo_minimo: 'advertencia',
    sin_stock: 'peligro',
}

export const TEXTO_ESTADO_CONTEO: Record<EstadoConteo, string> = {
    borrador: 'Borrador',
    aplicado: 'Aplicado',
    cancelado: 'Cancelado',
}

export const TONO_ESTADO_CONTEO: Record<EstadoConteo, TonoPildora> = {
    borrador: 'info',
    aplicado: 'exito',
    cancelado: 'neutro',
}

// ── Respuestas tipadas de las Server Actions (nunca throw — patrón 0.9) ───────
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
