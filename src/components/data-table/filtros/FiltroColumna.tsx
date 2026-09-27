'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRO DE COLUMNA — el embudo del encabezado (Guía 0.8 · MEJORA 26 Sep 2026)
//
// El usuario lo pidió tras verlo en otra app: *«los encabezados de la tabla servían
// como los filtros: el encabezado Fecha, si le apretabas, mostraba como un mini modal
// de filtro»*.
//
// Este archivo aporta DOS piezas:
//   1. `FiltroColumnaBoton` — el embudo que vive DENTRO del `<th>` y abre el panel.
//   2. `limpiarFiltroColumna` — devuelve el filtro a su valor vacío sin que el
//      descriptor tenga que cargar un `onQuitar` propio (el valor lo posee el PADRE:
//      aquí solo se le avisa, igual que en el resto de la tabla).
//
// ⚠️ El control NO se reinventa: se delega en el kit de la 0.8 Parte 9
// (`FiltroBusqueda` · `FiltroSelect` · `RangoFechas`). Si mañana hace falta un tipo
// nuevo («multiselect», «booleano»), se agrega al union `FiltroColumna` y su
// `case` aquí — el `DataTable` no se toca.
//
// ⚠️ El `<th>` ordenable tiene su propio `onClick`. Sin el `stopPropagation` del
// botón, abrir el filtro ORDENARÍA la columna de paso — el defecto clásico de meter
// un control dentro de un área clickeable.
// ═══════════════════════════════════════════════════════════════════════════════

import { Filter, FilterX } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { FiltroColumna } from '@/types/table'

import { FiltroBusqueda } from './FiltroBusqueda'
import { FiltroSelect } from './FiltroSelect'
import { RangoFechas } from './RangoFechas'

/** Valor «sin filtrar» de cada tipo — lo que se emite al quitar el filtro. */
export function limpiarFiltroColumna(filtro: FiltroColumna) {
    if (filtro.tipo === 'rango-fechas') filtro.onValorChange({ desde: '', hasta: '' })
    else filtro.onValorChange('')
}

interface FiltroColumnaBotonProps {
    /** Label de la columna — default de la etiqueta del panel. */
    label: string
    filtro: FiltroColumna
}

export function FiltroColumnaBoton({ label, filtro }: FiltroColumnaBotonProps) {
    const etiqueta = filtro.etiqueta ?? label
    const descripcion = filtro.activo
        ? `Filtro activo en ${etiqueta}${filtro.resumen ? `: ${filtro.resumen}` : ''}. Abrir para cambiarlo.`
        : `Filtrar por ${etiqueta}`

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    // El `<th>` ordena con su onClick: sin esto, abrir el filtro ordena.
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={descripcion}
                    title={descripcion}
                    className={cn(
                        // `size-9 md:size-6`: el encabezado mide 44px en móvil y el dedo
                        // necesita su área; en escritorio vuelve a la densidad del header.
                        'inline-flex size-9 shrink-0 items-center justify-center rounded transition-colors md:size-6',
                        'hover:bg-hover-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        filtro.activo ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'
                    )}
                >
                    <Filter className="size-3.5" aria-hidden="true" />
                </button>
            </PopoverTrigger>

            {/* `w-[22rem]` con tope de viewport: el rango de fechas pide ~322px para
                poner los dos campos en una línea; en un teléfono el tope lo obliga a
                envolver en vez de desbordar la pantalla. */}
            <PopoverContent
                align="start"
                className="w-[22rem] max-w-[calc(100vw-2rem)] space-y-3 border-border bg-surface-overlay shadow-premium-md"
            >
                {/* Solo el tipo `texto` necesita rótulo: los otros dos controles del kit
                    ya traen el suyo (`FiltroSelect` su label, `RangoFechas` «Fechas») y
                    repetirlo aquí sería decir dos veces lo mismo. */}
                {filtro.tipo === 'texto' && (
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Filtrar por {etiqueta}
                    </p>
                )}

                {filtro.tipo === 'texto' && (
                    <FiltroBusqueda
                        valor={filtro.valor}
                        onValorChange={filtro.onValorChange}
                        placeholder={filtro.placeholder ?? `Buscar en ${etiqueta.toLowerCase()}…`}
                    />
                )}

                {filtro.tipo === 'opciones' && (
                    <FiltroSelect
                        label={etiqueta}
                        ancho="completo"
                        opciones={filtro.opciones}
                        valor={filtro.valor}
                        onValorChange={filtro.onValorChange}
                        etiquetaCentinela={filtro.etiquetaTodos ?? 'Todas'}
                    />
                )}

                {filtro.tipo === 'rango-fechas' && (
                    <RangoFechas
                        desde={filtro.valor.desde}
                        hasta={filtro.valor.hasta}
                        onDesdeChange={(v) => filtro.onValorChange({ ...filtro.valor, desde: v })}
                        onHastaChange={(v) => filtro.onValorChange({ ...filtro.valor, hasta: v })}
                    />
                )}

                {filtro.activo && (
                    <button
                        type="button"
                        onClick={() => limpiarFiltroColumna(filtro)}
                        className={cn(
                            'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md md:min-h-9',
                            'border border-border text-xs text-muted-foreground',
                            'hover:bg-hover-background hover:text-foreground',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                    >
                        <FilterX className="size-3.5" aria-hidden="true" />
                        Quitar filtro
                    </button>
                )}
            </PopoverContent>
        </Popover>
    )
}
