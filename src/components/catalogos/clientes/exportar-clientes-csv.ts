// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR CLIENTES — CSV del listado (Guía 1.3 · Parte 9)
// Util pura (client): columnas visibles + filtros activos (PLAN §4 · usuario 04 Sep):
// Código · Nombre comercial · Tipo · Marca · Vendedor · Saldo actual · Estado.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Cliente } from '@/types/clientes'
import { TEXTO_ESTADO_CLIENTE, estadoDeCliente } from '@/types/clientes'

function escapar(valor: string): string {
    return `"${valor.replaceAll('"', '""')}"`
}

const formatearMXN = (monto: number): string =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)

export function exportarClientesCsv(clientes: Cliente[]): void {
    if (clientes.length === 0) return

    const encabezados = ['Código', 'Nombre comercial', 'Tipo', 'Marca', 'Vendedor', 'Saldo actual', 'Estado']
    const filas = clientes.map((c) =>
        [
            c.codigo,
            c.nombre_comercial,
            c.tipo_cliente_nombre ?? '',
            c.marca_nombre ?? '',
            c.vendedor_nombre ?? '',
            formatearMXN(c.saldo_actual),
            TEXTO_ESTADO_CLIENTE[estadoDeCliente(c)],
        ]
            .map(escapar)
            .join(',')
    )

    // BOM UTF-8 para que Excel abra el archivo sin romper acentos.
    const csv = `\uFEFF${[encabezados.map(escapar).join(','), ...filas].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
}
