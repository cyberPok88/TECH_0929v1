'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR PRODUCTOS CSV — util local (Guía 1.2 · Parte 5)
// Exporta las columnas base + los atributos aplanados (unión de claves presentes
// en las filas exportadas — decisión usuario 04 Sep). Separador ';' + BOM UTF-8
// para abrir bien en Excel MX (patrón 1.1 exportar-proveedores-csv).
// ═══════════════════════════════════════════════════════════════════════════════

import type { Producto } from '@/types/productos'

const BASE: { key: keyof Producto | 'estado'; label: string }[] = [
    { key: 'sku', label: 'SKU' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'categoria_nombre', label: 'Categoría' },
    { key: 'marca_nombre', label: 'Marca' },
    { key: 'precio_base', label: 'Precio base' },
    { key: 'precio_minimo', label: 'Precio mínimo' },
    { key: 'codigo_barras', label: 'Código de barras' },
    { key: 'estado', label: 'Estado' },
]

function celda(valor: unknown): string {
    const texto = valor === null || valor === undefined ? '' : String(valor)
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function exportarProductosCsv(productos: Producto[]): void {
    if (productos.length === 0) return

    // Atributos: unión de claves en orden de primera aparición (aplanado).
    const clavesAtributos: string[] = []
    for (const p of productos) {
        for (const clave of Object.keys(p.atributos)) {
            if (!clavesAtributos.includes(clave)) clavesAtributos.push(clave)
        }
    }

    const encabezado = [
        ...BASE.map((c) => c.label),
        ...clavesAtributos,
    ].join(';')

    const filas = productos.map((p) => {
        const base = BASE.map((c) => {
            if (c.key === 'estado') {
                return p.es_archivado ? 'Archivado' : p.es_activo ? 'Activo' : 'Inactivo'
            }
            return p[c.key as keyof Producto]
        })
        const atributos = clavesAtributos.map((clave) => p.atributos[clave] ?? '')
        return [...base, ...atributos].map(celda).join(';')
    })

    // BOM UTF-8 + saltos CRLF (Excel MX).
    const csv = '\uFEFF' + [encabezado, ...filas].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `productos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(enlace)
    enlace.click()
    document.body.removeChild(enlace)
    URL.revokeObjectURL(url)
}
