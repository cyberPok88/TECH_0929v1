// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR VENTAS — CSV del listado (Guía 1.8 · 01 Oct 2026)
// Util pura (client): los filtros activos · ';' + BOM · descarga ventas-{fecha}.csv.
// Una nota CANCELADA se exporta con Estado «Cancelada» y pago vacío — coherente con
// la columna Estado del listado (una sola verdad).
// ⚠️ El CSV lleva lo que el FILTRO devuelve, no la página visible: exportar una
//    página de 25 de 400 notas sería un archivo que miente.
// ═══════════════════════════════════════════════════════════════════════════════

import { ETIQUETA_ESTADO_PAGO, type NotaRemisionListado } from '@/types/ventas'

function escapar(valor: string): string {
    return `"${valor.replaceAll('"', '""')}"`
}

function fechaCorta(fecha: string | null | undefined): string {
    if (!fecha) return ''
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

export function exportarVentasCsv(notas: NotaRemisionListado[]): void {
    if (notas.length === 0) return

    const encabezados = [
        'Folio',
        'Fecha',
        'Vence',
        'Cliente',
        'Código',
        'Vendedor',
        'Condición',
        'Estado de pago',
        'Total',
        'Saldo',
    ]

    const filas = notas.map((n) =>
        [
            n.folio,
            fechaCorta(n.fecha_emision),
            fechaCorta(n.fecha_vencimiento),
            n.cliente_nombre ?? '',
            n.cliente_codigo ?? '',
            n.vendedor_nombre ?? '',
            n.es_credito ? 'Crédito' : 'Contado',
            n.es_cancelada
                ? 'Cancelada'
                : n.estado_pago_clave
                  ? ETIQUETA_ESTADO_PAGO[n.estado_pago_clave]
                  : (n.estado_pago_nombre ?? ''),
            n.total.toFixed(2),
            n.es_cancelada ? '0.00' : n.saldo_pendiente.toFixed(2),
        ]
            .map(escapar)
            .join(';')
    )

    const csv = `\uFEFF${[encabezados.map(escapar).join(';'), ...filas].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `ventas-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
}
