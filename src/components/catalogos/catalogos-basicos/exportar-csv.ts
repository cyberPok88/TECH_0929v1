// exportar-csv.ts — exportación CSV del mini-CRUD activo (Guía 1.0 · P9)
export function exportarCsvCatalogo(
  filas: Record<string, unknown>[],
  columnas: { key: string; etiqueta: string }[],
  nombreArchivo: string,
) {
  const encabezados = columnas.map((c) => c.etiqueta).join(';')
  const cuerpo = filas.map((f) =>
    columnas.map((c) => {
      const v = f[c.key]
      if (v === null || v === undefined) return ''
      if (typeof v === 'object') return JSON.stringify(v).replaceAll(';', ' ')
      return String(v).replaceAll(';', ' ')
    }).join(';'),
  )
  const csv = '\uFEFF' + [encabezados, ...cuerpo].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
