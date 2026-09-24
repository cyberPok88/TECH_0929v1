'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RECEPCION FILTERS — Filtros del listado de recepción (Guía 1.6 · P2 · Dumb)
// Compone CatalogoFilters + búsqueda por folio · estado · rango de fechas.
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect, RangoFechas } from '@/components/data-table'
import type { EstadoEntrada, FiltrosEntradas } from '@/types/entradas'
import { TEXTO_ESTADO_ENTRADA } from '@/types/entradas'

export interface OpcionFiltro {
    valor: string
    etiqueta: string
}

export const FILTROS_ENTRADAS_DEFAULT: FiltrosEntradas = {
    busqueda: '',
    estado: '',
    fecha_desde: '',
    fecha_hasta: '',
}

const OPCIONES_ESTADO: OpcionFiltro[] = (
    Object.keys(TEXTO_ESTADO_ENTRADA) as EstadoEntrada[]
).map((clave) => ({ valor: clave, etiqueta: TEXTO_ESTADO_ENTRADA[clave] }))

interface RecepcionFiltersProps {
    filtros: FiltrosEntradas
    onFiltrosChange: (patch: Partial<FiltrosEntradas>) => void
    contador?: number
    disabled?: boolean
}

export function RecepcionFilters({ filtros, onFiltrosChange, contador, disabled = false }: RecepcionFiltersProps) {
    const hayFiltrosActivos =
        filtros.busqueda !== '' || filtros.estado !== '' || filtros.fecha_desde !== '' || filtros.fecha_hasta !== ''

    const limpiar = () => onFiltrosChange(FILTROS_ENTRADAS_DEFAULT)

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por folio o proveedor…"
            contador={contador}
            sustantivoContador={{ singular: 'entrada', plural: 'entradas' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
        >
            {/* ⭐ MEJORA 22 Sep 2026 — los controles van en GRID (no en fila que se apila a
                la izquierda): así el apartado usa el ancho de la pantalla y cada control
                tiene su columna. En escritorio: estado · fechas · ayuda. */}
            <div className="grid w-full grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[14rem_21rem_minmax(0,1fr)] lg:items-end">
                <FiltroSelect
                    label="Estado"
                    opciones={OPCIONES_ESTADO}
                    valor={filtros.estado}
                    onValorChange={(v) =>
                        onFiltrosChange({ estado: v === '__todos__' ? '' : (v as FiltrosEntradas['estado']) })
                    }
                    disabled={disabled}
                />
                <RangoFechas
                    desde={filtros.fecha_desde}
                    hasta={filtros.fecha_hasta}
                    onDesdeChange={(v) => onFiltrosChange({ fecha_desde: v })}
                    onHastaChange={(v) => onFiltrosChange({ fecha_hasta: v })}
                    disabled={disabled}
                />
                <p className="hidden text-xs leading-relaxed text-muted-foreground lg:block lg:pb-2.5">
                    El buscador cubre <span className="font-medium text-foreground">folio</span> y{' '}
                    <span className="font-medium text-foreground">proveedor</span>; el rango de fechas
                    incluye el día completo de «hasta».
                </p>
            </div>
        </CatalogoFilters>
    )
}
