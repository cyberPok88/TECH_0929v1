// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR ENTRADAS — CSV del listado (Guía 1.6 · MEJORA 20 Sep 2026)
// Util pura (client): ';' + BOM (Excel MX) · descarga entradas-{fecha}.csv.
// Columnas: Folio · Fecha · Proveedor · Partidas · Piezas · Total · Devolución · Nota ·
//           Estado · Origen · Resultado · Capturó.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Entrada } from '@/types/entradas'
import { TEXTO_ESTADO_ENTRADA } from '@/types/entradas'

function escapar(valor: string): string {
    return `"${valor.replaceAll('"', '""')}"`
}

function fechaCorta(fecha: string): string {
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function exportarEntradasCsv(entradas: Entrada[]): void {
    if (entradas.length === 0) return

    const encabezados = [
        'Folio',
        'Fecha',
        'Proveedor',
        'Partidas',
        'Piezas',
        'Total',
        'Devolución',
        'Nota',
        'Estado',
        'Origen',
        'Resultado',
        'Capturó',
    ]

    const filas = entradas.map((e) =>
        [
            e.folio,
            fechaCorta(e.fecha),
            e.proveedor_nombre ?? '',
            String(e.partidas_count),
            String(e.piezas_total),
            e.monto_total.toFixed(2),
            String(e.devolucion_total),
            e.nota_folio ?? '',
            TEXTO_ESTADO_ENTRADA[e.estado],
            e.origen === 'directa' ? 'Nota directa' : 'Flujo',
            e.resultado_rev === 'CON_MALAS'
                ? 'Con malas'
                : e.resultado_rev === 'SIN_MALAS'
                  ? 'Sin malas'
                  : '',
            e.creador_nombre ?? '',
        ]
            .map(escapar)
            .join(';')
    )

    const csv = `\uFEFF${[encabezados.map(escapar).join(';'), ...filas].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `entradas-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
}
