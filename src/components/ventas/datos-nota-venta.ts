// ═══════════════════════════════════════════════════════════════════════════════
// DATOS DEL PAPEL — NOTA DE VENTA (Guía 1.8 · Parte 5 · camino C de plantilla-documento)
//
// ⭐ EL ÚNICO LUGAR donde un dato del papel se formatea (ley L6: un solo lugar por
//    cifra). El motor PINTA, no calcula: aquí salen `$1.234,00` y `28/09/2026`.
// ⚠️ El FORMATO no se inventa aquí: el dinero lo pinta `formatearMoneda` de la casa
//    (`@/lib/utils/formatters`, dueño Guía 0.2) y la fecha `formatearFecha` del módulo
//    (Parte 2) — este archivo los CONSUME, no los redefine. Nota histórica: el
//    `formatearMXN` local que vivía en `columnas-venta.tsx` se retiró el 02 Oct 2026
//    porque el proyecto prohíbe el 11º duplicado del formateador de dinero.
// ⭐ Las PARTIDAS van como LISTA: el motor las recorre con `{{#partidas}}`. Con el
//    tipo estrecho (escalares), este papel no compilaría — es el defecto real que
//    destapó la migración de Recepción.
// ⚠️ El MEMBRETE no se arma aquí: lo mezcla el punto de invocación, y lo recibe
//    TAMBIÉN el respaldo — si viviera solo en el camino de la plantilla, al
//    desactivarla el papel perdería la razón social.
// ⚠️ Renombrar una clave sin renombrarla en la plantilla NO rompe el build: sale en blanco.
// ═══════════════════════════════════════════════════════════════════════════════

import type { VariablesDocumento } from '@/lib/plantillas/motor'
import { formatearFecha } from '@/components/ventas/columnas-venta'
import { formatearMoneda } from '@/lib/utils/formatters'
import {
    ETIQUETA_ESTADO_PAGO,
    type NotaRemisionDetalle,
} from '@/types/ventas'

export function construirDatosNotaVenta(nota: NotaRemisionDetalle): VariablesDocumento {
    return {
        // ── El documento ───────────────────────────────────────────────────────
        folio: nota.folio,
        fecha: formatearFecha(nota.fecha_emision),
        vencimiento: formatearFecha(nota.fecha_vencimiento),
        condicion: nota.es_credito ? 'Crédito' : 'Contado',
        estado_pago: nota.es_cancelada
            ? 'Cancelada'
            : nota.estado_pago_clave
              ? ETIQUETA_ESTADO_PAGO[nota.estado_pago_clave]
              : '',
        cancelada: nota.es_cancelada,
        motivo_cancelacion: nota.motivo_cancelacion ?? '',
        notas: nota.notas ?? '',

        // ── El cliente ─────────────────────────────────────────────────────────
        cliente: nota.cliente_nombre ?? '',
        cliente_codigo: nota.cliente_codigo ?? '',
        marca: nota.marca_nombre ?? '',
        vendedor: nota.vendedor_nombre ?? '',

        // ── Los totales (SIEMPRE formateados) ─────────────────────────────────
        subtotal: formatearMoneda(nota.subtotal),
        descuento_global: formatearMoneda(nota.descuento_global),
        impuestos: formatearMoneda(nota.impuestos),
        total: formatearMoneda(nota.total),
        saldo: formatearMoneda(nota.saldo_pendiente),

        // ── ⭐ LA LISTA: las partidas (el motor la recorre con {{#partidas}}) ──
        partidas: nota.partidas.map((p) => ({
            orden: String(p.orden),
            descripcion: p.descripcion_snapshot,
            cantidad: String(Number(p.cantidad)),
            precio: formatearMoneda(Number(p.precio_unitario_final)),
            importe: formatearMoneda(Number(p.total)),
            // ⭐ Los N NS de la PIEZA (uno por renglón del papel) — y la cortesía, dicha
            series: p.series.join(', '),
            cortesia: p.es_cortesia,
            motivo_cortesia: p.motivo_cortesia ?? '',
            // Cuando el renglón tiene una sola pieza con serie, se muestra sola
            serie: p.series.length === 1 ? p.series[0] : '',
        })),
    }
}
