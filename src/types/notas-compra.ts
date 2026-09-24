// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — NOTAS DE COMPRA (Guía 1.4 · rediseño 05 Sep 2026)
// Espejo LITERAL de public.notas_compra + partidas_nota + pagos_nota
// (GUIAS/16/docs/bd-notas-compra.md §3 · 24/7/9 columnas reales).
// Los nombres snake_case son contrato con la BD: renombrar uno guarda el dato
// equivocado sin romper el build (CLAUDE.md, regla 4). La BD real manda.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Vocabulario cerrado (CHECKs en BD · PLAN/rediseño 05 Sep) ──────────────────
export type EstadoFisicoNota = 'por_recibir' | 'recibida'

export type OrigenNota = 'directa' | 'flujo'

// Claves del catálogo estados_pago (BD 0.4). La UI muestra "Por pagar" para
// `pendiente` (saldo = total).
export type EstadoPagoClave = 'vencida' | 'pendiente' | 'parcial' | 'pagada' | 'cancelada'

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro'

// ── Encabezado — fila del listado / ficha (embeds aplanados por la SA) ──────────
export interface NotaCompra {
    id: string
    folio: string
    id_proveedor: string
    proveedor_codigo: string | null
    proveedor_nombre: string | null
    origen: OrigenNota
    id_entrada: string | null
    fecha_nota: string
    estado_fisico: EstadoFisicoNota
    id_estado_pago: string
    estado_pago_clave: EstadoPagoClave | null
    estado_pago_nombre: string | null
    total: number
    saldo_pendiente: number
    numero_factura_proveedor: string | null
    referencia_proveedor: string | null
    notas: string | null
    es_cancelada: boolean
    motivo_cancelacion: string | null
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
}

export interface PartidaNota {
    id: string
    id_nota: string
    /** ⭐ NULL cuando la partida es una línea soft del flujo (sin SKU — se resuelve en Almacén). */
    id_producto: string | null
    producto_codigo: string | null // display (embeds en detalle)
    producto_nombre: string | null
    /** ⭐ Línea soft (categoría + tipo + capacidad) cuando la nota nace del flujo de Entradas. */
    descripcion: string | null
    cantidad: number
    costo_acordado: number
    subtotal_partida: number
    orden: number
}

export interface PagoNota {
    id: string
    id_nota: string
    fecha_pago: string
    monto: number
    metodo: MetodoPago
    referencia_bancaria: string | null
    notas: string | null
    creado_por: string | null
    created_at: string
}

export type NotaCompraLista = NotaCompra

/** Detalle de la ficha: encabezado + partidas + historial de pagos. */
export interface NotaCompraDetalle extends NotaCompra {
    partidas: PartidaNota[]
    pagos: PagoNota[]
}

// ── Estado de la barra de filtros ──────────────────────────────────────────────
export interface FiltrosNotaCompra {
    busqueda: string
    /** '' = todos los proveedores */
    idProveedor: string
    /** '' = todos los estados físicos */
    estadoFisico: EstadoFisicoNota | ''
    /** '' = todos los estados de pago (claves con saldo: pendiente/parcial/pagada) */
    estadoPago: EstadoPagoClave | ''
    /** '' = sin filtro (yyyy-mm-dd sobre fecha_nota) */
    fechaDesde: string
    /** '' = sin filtro */
    fechaHasta: string
}

// ── Forma canónica del formulario (alta/edición) ───────────────────────────────
// Partida cruda del grid: id '' = nueva · id_producto obligatorio.
export interface PartidaNotaForm {
    id: string
    id_producto: string
    cantidad: string
    costo_acordado: string
}

export interface NotaCompraFormData {
    id_proveedor: string
    fecha_nota: string
    numero_factura_proveedor: string
    referencia_proveedor: string
    notas: string
    partidas: PartidaNotaForm[]
}

/** Fecha de hoy en yyyy-mm-dd (local). */
function fechaHoyISO(): string {
    const hoy = new Date()
    const mes = String(hoy.getMonth() + 1).padStart(2, '0')
    const dia = String(hoy.getDate()).padStart(2, '0')
    return `${hoy.getFullYear()}-${mes}-${dia}`
}

export function notaFormDataVacia(): NotaCompraFormData {
    return {
        id_proveedor: '',
        fecha_nota: fechaHoyISO(),
        numero_factura_proveedor: '',
        referencia_proveedor: '',
        notas: '',
        partidas: [],
    }
}

export function notaAFormData(n: NotaCompraDetalle): NotaCompraFormData {
    return {
        id_proveedor: n.id_proveedor,
        fecha_nota: n.fecha_nota,
        numero_factura_proveedor: n.numero_factura_proveedor ?? '',
        referencia_proveedor: n.referencia_proveedor ?? '',
        notas: n.notas ?? '',
        partidas: n.partidas.map((p) => ({
            id: p.id,
            id_producto: p.id_producto ?? '',
            cantidad: String(p.cantidad),
            costo_acordado: String(p.costo_acordado),
        })),
    }
}

// ── Display — vocabulario de la pantalla ───────────────────────────────────────
export const TEXTO_ESTADO_FISICO: Record<EstadoFisicoNota, string> = {
    por_recibir: 'Por recibir',
    recibida: 'Recibida',
}

export const TONO_ESTADO_FISICO: Record<EstadoFisicoNota, TonoPildora> = {
    por_recibir: 'advertencia',
    recibida: 'exito',
}

/** Muestra "Por pagar" para la clave `pendiente` del catálogo. */
export const TEXTO_ESTADO_PAGO_NOTA: Record<EstadoPagoClave, string> = {
    vencida: 'Vencida',
    pendiente: 'Por pagar',
    parcial: 'Pago parcial',
    pagada: 'Pagada',
    cancelada: 'Cancelada',
}

export const TONO_ESTADO_PAGO_NOTA: Record<EstadoPagoClave, TonoPildora> = {
    vencida: 'peligro',
    pendiente: 'advertencia',
    parcial: 'info',
    pagada: 'exito',
    cancelada: 'neutro',
}

export const TEXTO_METODO_PAGO: Record<MetodoPago, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    cheque: 'Cheque',
    otro: 'Otro',
}

export const OPCIONES_METODO_PAGO: MetodoPago[] = [
    'efectivo',
    'transferencia',
    'tarjeta',
    'cheque',
    'otro',
]

/** Estados de pago visibles en filtros/listado (los que derivan del saldo). */
export const OPCIONES_ESTADO_PAGO_NOTA: EstadoPagoClave[] = ['pendiente', 'parcial', 'pagada']

export const TEXTO_ORIGEN_NOTA: Record<OrigenNota, string> = {
    directa: 'Directa',
    flujo: 'Del flujo de entradas',
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
