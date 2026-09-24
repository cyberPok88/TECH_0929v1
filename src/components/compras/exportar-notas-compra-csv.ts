// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR NOTAS DE COMPRA — CSV del listado (Guía 1.4 · rediseño)
// Util pura (client): visibles + filtros · ';' + BOM · descarga notas-{fecha}.csv.
// Columnas: Folio · Fecha · Proveedor · Código · Origen · Estado · Estado de pago ·
// Total · Saldo · Nº factura/remisión.
// FIX VF 05 Sep: una nota CANCELADA se exporta con Estado "Cancelada" y pago vacío
// (coherente con la columna Estado del listado — no como "Por recibir/Por pagar").
// ═══════════════════════════════════════════════════════════════════════════════

import type { NotaCompra } from '@/types/notas-compra'
import {
    TEXTO_ESTADO_FISICO,
    TEXTO_ESTADO_PAGO_NOTA,
    TEXTO_ORIGEN_NOTA,
} from '@/types/notas-compra'

function escapar(valor: string): string {
    return `"${valor.replaceAll('"', '""')}"`
}

function fechaCorta(fecha: string | null | undefined): string {
    if (!fecha) return ''
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

export function exportarNotasCompraCsv(notas: NotaCompra[]): void {
    if (notas.length === 0) return

    const encabezados = [
        'Folio',
        'Fecha',
        'Proveedor',
        'Código',
        'Origen',
        'Estado',
        'Estado de pago',
        'Total',
        'Saldo',
        'Nº factura/remisión',
    ]

    const filas = notas.map((n) =>
        [
            n.folio,
            fechaCorta(n.fecha_nota),
            n.proveedor_nombre ?? '',
            n.proveedor_codigo ?? '',
            TEXTO_ORIGEN_NOTA[n.origen],
            n.es_cancelada ? 'Cancelada' : TEXTO_ESTADO_FISICO[n.estado_fisico],
            n.es_cancelada
                ? ''
                : n.estado_pago_clave
                  ? TEXTO_ESTADO_PAGO_NOTA[n.estado_pago_clave]
                  : (n.estado_pago_nombre ?? ''),
            n.total.toFixed(2),
            n.saldo_pendiente.toFixed(2),
            n.numero_factura_proveedor ?? '',
        ]
            .map(escapar)
            .join(';')
    )

    const csv = `\uFEFF${[encabezados.map(escapar).join(';'), ...filas].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `notas-compra-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
}
