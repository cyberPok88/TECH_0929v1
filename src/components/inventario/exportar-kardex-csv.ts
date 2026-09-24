import type { MovimientoInventario } from '@/types/inventario'
import { TEXTO_ORIGEN, TEXTO_TIPO_MOVIMIENTO } from '@/types/inventario'
import type { Producto } from '@/types/productos'

function escapar(valor: string): string {
    return `"${valor.replaceAll('"', '""')}"`
}

export function exportarKardexCsv(filas: MovimientoInventario[], producto: Producto): void {
    if (filas.length === 0) return

    const encabezados = [
        'Fecha',
        'Tipo',
        'Cantidad',
        'Stock anterior',
        'Stock resultante',
        'Origen',
        'Motivo',
        'Usuario',
    ]

    const cuerpo = filas.map((m) =>
        [
            new Date(m.created_at).toLocaleDateString('es-MX'),
            TEXTO_TIPO_MOVIMIENTO[m.tipo_movimiento] ?? m.tipo_movimiento,
            String(m.cantidad),
            String(m.stock_anterior),
            String(m.stock_resultante),
            m.origen_tabla ? (TEXTO_ORIGEN[m.origen_tabla] ?? m.origen_tabla) : '',
            m.motivo ?? '',
            m.creador_nombre ?? '',
        ]
            .map(escapar)
            .join(';')
    )

    const csv = `\uFEFF${[encabezados.map(escapar).join(';'), ...cuerpo].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `kardex-${producto.sku}-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
}
