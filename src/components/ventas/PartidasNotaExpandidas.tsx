'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS NOTA EXPANDIDAS — contenido de la fila expandible (Guía 1.8)
// Segundo consumidor de `DataTable.renderFilaExpandida` (el primero fue 1.6):
// muestra las PARTIDAS de la nota dentro de su propia fila, sin abrir la ficha.
//
// ⭐ El resumen EN LÍNEA, no la ficha: aquí se ve QUÉ se vendió. El estado de cuenta
//    del cliente y las acciones completas viven en `NotaRemisionFicha` (Parte 4).
// ⭐ El NS se muestra cuando existe (R30): es lo que permite rastrear la pieza.
// ⭐ La CORTESÍA se marca como tal (R10): no se disfraza de descuento.
// ⚠️ Carga sus propias partidas (`listarPartidasNota`): 25 filas con sus renglones
//    multiplicarían la consulta del listado.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

import { CLASE_CAJA_TABLA, CLASE_THEAD_TABLA, CLASE_TH_TABLA, Pildora } from '@/components/data-table'
import { Spinner } from '@/components/ui/spinner'
import { listarPartidasNota } from '@/lib/actions/ventas'
import { cn } from '@/lib/utils'
import { formatearMoneda } from '@/lib/utils/formatters'
import type { NotaRemisionListado, PartidaRemisionListado } from '@/types/ventas'

const TH = cn(CLASE_TH_TABLA, 'px-2.5 py-1.5')

export function PartidasNotaExpandidas({
    nota,
    onExpandida,
}: {
    nota: NotaRemisionListado
    /** Avisa a la página cuál es la fila ABIERTA (su toolbar imprime/actúa sobre esa nota). */
    onExpandida?: (n: NotaRemisionListado) => void
}) {
    const [partidas, setPartidas] = useState<PartidaRemisionListado[]>([])
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        let activo = true
        void listarPartidasNota(nota.id).then((r) => {
            if (!activo) return
            if (r.success) setPartidas(r.data ?? [])
            setCargando(false)
            // El callback es el `setState` del padre (estable): no re-dispara el efecto.
            onExpandida?.(nota)
        })
        return () => {
            activo = false
        }
    }, [nota, onExpandida])

    /** Σ de renglones — el pie cuadra con la columna Total de la tabla madre. */
    const totalRenglones = partidas.reduce((s, p) => s + Number(p.total), 0)

    if (cargando) return <Spinner etiqueta="Cargando partidas…" className="py-1" />

    if (partidas.length === 0) {
        return <p className="text-sm text-muted-foreground">Esta nota no tiene partidas.</p>
    }

    return (
        <div className="flex flex-col gap-2">
            <div className={CLASE_CAJA_TABLA}>
                {/* ⚠️ `border-collapse`: con el default `separate` los bordes de un `<tr>` NO se
                    pintan y las filas se leen como una masa sin costuras (lo documentó 1.6). */}
                <table className="w-full border-collapse text-[14.5px]">
                    <thead className={CLASE_THEAD_TABLA}>
                        <tr>
                            <th className={cn(TH, 'w-10')}>#</th>
                            <th className={cn(TH, 'text-left')}>Producto</th>
                            <th className={cn(TH, 'w-20')} title="Piezas vendidas de este renglón">
                                Cant.
                            </th>
                            <th className={cn(TH, 'w-28')} title="Precio final por pieza (ya con descuentos)">
                                Precio
                            </th>
                            <th className={cn(TH, 'w-20')} title="Descuento adicional negociado (R32③)">
                                Desc.
                            </th>
                            <th className={cn(TH, 'w-28')} title="Número de serie de la pieza (R30)">
                                NS
                            </th>
                            <th className={cn(TH, 'w-28')}>Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partidas.map((p) => (
                            <tr key={p.id} className="border-t border-border">
                                <td className="px-2.5 py-2 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {p.orden}
                                </td>
                                <td className="px-2.5 py-2">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <span className="truncate">{p.descripcion_snapshot}</span>
                                        {/* ⭐ La cortesía es su PROPIO caso (R10): se marca */}
                                        {p.es_cortesia && (
                                            <Pildora
                                                texto="Cortesía"
                                                tono="info"
                                            />
                                        )}
                                    </span>
                                    {p.es_cortesia && p.motivo_cortesia && (
                                        <span className="block text-[11.5px] text-muted-foreground">
                                            {p.motivo_cortesia}
                                        </span>
                                    )}
                                </td>
                                <td className="px-2.5 py-2 text-center tabular-nums">
                                    {Number(p.cantidad)}
                                </td>
                                <td className="px-2.5 py-2 text-right tabular-nums">
                                    {formatearMoneda(Number(p.precio_unitario_final))}
                                </td>
                                <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                                    {Number(p.descuento_adicional_porcentaje) > 0
                                        ? `${(Number(p.descuento_adicional_porcentaje) * 100).toFixed(1)}%`
                                        : '—'}
                                </td>
                                <td className="px-2.5 py-2 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {/* ⭐ Los N NS del renglón (uno por PIEZA · PLAN §6.5). Con
                                        varios, se apilan en vertical — es lo que hace legible un
                                        renglón de 10 discos sin ensanchar la columna. */}
                                    {p.series.length === 0
                                        ? '—'
                                        : p.series.length === 1
                                          ? p.series[0]
                                          : (
                                            <span className="flex flex-col gap-0.5">
                                                {p.series.map((ns) => (
                                                    <span key={ns}>{ns}</span>
                                                ))}
                                            </span>
                                        )}
                                </td>
                                <td className="px-2.5 py-2 text-right tabular-nums">
                                    {formatearMoneda(Number(p.total))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-4 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>
                    {partidas.length} {partidas.length === 1 ? 'renglón' : 'renglones'}
                </span>
                <span>
                    Σ {formatearMoneda(totalRenglones)}
                </span>
            </div>
        </div>
    )
}
