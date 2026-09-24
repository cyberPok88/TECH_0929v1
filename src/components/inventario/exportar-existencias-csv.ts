import type { ExistenciaProducto } from '@/types/inventario'
import { TEXTO_ESTADO_CONSUMO } from '@/types/inventario'

function escapar(valor: string): string {
    return `"${valor.replaceAll('"', '""')}"`
}

export function exportarExistenciasCsv(filas: ExistenciaProducto[]): void {
    if (filas.length === 0) return

    const encabezados = [
        'SKU',
        'Producto',
        'Categoría',
        'Marca',
        'Stock',
        'Mínimo',
        'Ubicación',
        'Estado',
    ]

    const cuerpo = filas.map((e) =>
        [
            e.sku,
            e.nombre,
            e.categoria_nombre ?? '',
            e.marca_nombre ?? '',
            e.stock_actual.toLocaleString('es-MX'),
            e.stock_minimo.toLocaleString('es-MX'),
            e.ubicacion_nombre ?? '',
            TEXTO_ESTADO_CONSUMO[e.estado_existencia],
        ]
            .map(escapar)
            .join(';')
    )

    const csv = `\uFEFF${[encabezados.map(escapar).join(';'), ...cuerpo].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `existencias-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
}
