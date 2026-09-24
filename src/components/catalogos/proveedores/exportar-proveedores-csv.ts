// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR PROVEEDORES — CSV del listado (Guía 1.1 · Parte 4)
// Util pura (client): genera y descarga el CSV con las MISMAS columnas del
// listado vigente y respeta los filtros activos (PLAN §4 · usuario 03 Sep):
// Código · Nombre comercial · RFC · Tipo · Estado. Archivo proveedores-{fecha}.csv.
// Patrón del export del hub 1.0 (exportar-csv.ts) — sin Server Action: volumen
// «500 registros, la fila ya está en el cliente.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Proveedor } from '@/types/proveedores'
import { TEXTO_ESTADO, TEXTO_TIPO, estadoDeProveedor } from '@/types/proveedores'

function escapar(valor: string): string {
    return `"${valor.replaceAll('"', '""')}"`
}

export function exportarProveedoresCsv(proveedores: Proveedor[]): void {
    if (proveedores.length === 0) return

    const encabezados = ['Código', 'Nombre comercial', 'RFC', 'Tipo', 'Estado']
    const filas = proveedores.map((p) =>
        [
            p.codigo,
            p.nombre_comercial,
            p.rfc ?? '',
            TEXTO_TIPO[p.tipo],
            TEXTO_ESTADO[estadoDeProveedor(p)],
        ].map(escapar).join(',')
    )

    // BOM UTF-8 para que Excel abra el archivo sin romper acentos.
    const csv = `\uFEFF${[encabezados.map(escapar).join(','), ...filas].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `proveedores-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
}
