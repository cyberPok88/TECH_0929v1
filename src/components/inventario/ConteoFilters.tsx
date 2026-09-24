'use client'

import { FilterX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FiltroSelect, RangoFechas } from '@/components/data-table'
import type { FiltrosConteos } from '@/types/inventario'
import type { EstadoConteo } from '@/types/inventario'
import { TEXTO_ESTADO_CONTEO } from '@/types/inventario'

export const FILTROS_CONTEOS_DEFAULT: FiltrosConteos = {
    estado: '',
    fecha_desde: '',
    fecha_hasta: '',
}

const OPCIONES_ESTADO: { valor: EstadoConteo; etiqueta: string }[] = (
    ['borrador', 'aplicado', 'cancelado'] as const
).map((clave) => ({ valor: clave, etiqueta: TEXTO_ESTADO_CONTEO[clave] }))

interface ConteoFiltersProps {
    filtros: FiltrosConteos
    onFiltrosChange: (patch: Partial<FiltrosConteos>) => void
    contador?: number
    disabled?: boolean
}

export function ConteoFilters({
    filtros,
    onFiltrosChange,
    contador,
    disabled = false,
}: ConteoFiltersProps) {
    const hayFiltrosActivos =
        filtros.estado !== '' || filtros.fecha_desde !== '' || filtros.fecha_hasta !== ''

    const limpiar = () => onFiltrosChange(FILTROS_CONTEOS_DEFAULT)

    return (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <FiltroSelect
                label="Estado"
                opciones={OPCIONES_ESTADO}
                valor={filtros.estado}
                onValorChange={(v) =>
                    onFiltrosChange({ estado: (v === '__todos__' ? '' : v) as FiltrosConteos['estado'] })
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
            {contador !== undefined && (
                <span className="pb-2 text-sm text-muted-foreground">
                    {contador} conteo{contador === 1 ? '' : 's'}
                </span>
            )}
            {hayFiltrosActivos && (
                <Button type="button" variant="ghost" size="sm" onClick={limpiar} disabled={disabled}>
                    <FilterX className="mr-2 h-4 w-4" /> Limpiar filtros
                </Button>
            )}
        </div>
    )
}
