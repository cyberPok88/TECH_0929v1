'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTARIO FILTERS — Filtros de Existencias (Guía 1.5 · Dumb)
// Compone CatalogoFilters + controles del dominio (PLAN Inventario):
// búsqueda (nombre/SKU) · categoría · marca · estado (Ok/Bajo mínimo/Sin stock).
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect } from '@/components/data-table'
import type { FiltrosExistencias } from '@/types/inventario'
import { TEXTO_ESTADO_CONSUMO } from '@/types/inventario'

export interface OpcionFiltro {
    valor: string
    etiqueta: string
}

export const FILTROS_EXISTENCIAS_DEFAULT: FiltrosExistencias = {
    busqueda: '',
    id_categoria: '',
    id_marca: '',
    estado: '',
}

const OPCIONES_ESTADO: { valor: 'ok' | 'bajo_minimo' | 'sin_stock'; etiqueta: string }[] = (
    ['ok', 'bajo_minimo', 'sin_stock'] as const
).map((clave) => ({ valor: clave, etiqueta: TEXTO_ESTADO_CONSUMO[clave] }))

interface InventarioFiltersProps {
    filtros: FiltrosExistencias
    onFiltrosChange: (patch: Partial<FiltrosExistencias>) => void
    categorias: OpcionFiltro[]
    marcas: OpcionFiltro[]
    contador?: number
    disabled?: boolean
}

export function InventarioFilters({
    filtros,
    onFiltrosChange,
    categorias,
    marcas,
    contador,
    disabled = false,
}: InventarioFiltersProps) {
    const hayFiltrosActivos =
        filtros.busqueda !== '' ||
        filtros.id_categoria !== '' ||
        filtros.id_marca !== '' ||
        filtros.estado !== ''

    const limpiar = () => onFiltrosChange(FILTROS_EXISTENCIAS_DEFAULT)

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por nombre o SKU…"
            contador={contador}
            sustantivoContador={{ singular: 'producto', plural: 'productos' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
        >
            <FiltroSelect
                label="Categoría"
                opciones={categorias}
                valor={filtros.id_categoria}
                onValorChange={(v) => onFiltrosChange({ id_categoria: v === '__todos__' ? '' : v })}
                disabled={disabled}
            />
            <FiltroSelect
                label="Marca"
                opciones={marcas}
                valor={filtros.id_marca}
                onValorChange={(v) => onFiltrosChange({ id_marca: v === '__todos__' ? '' : v })}
                disabled={disabled}
            />
            <FiltroSelect
                label="Estado"
                opciones={OPCIONES_ESTADO}
                valor={filtros.estado}
                onValorChange={(v) =>
                    onFiltrosChange({
                        estado: (v === '__todos__' ? '' : v) as FiltrosExistencias['estado'],
                    })
                }
                disabled={disabled}
            />
        </CatalogoFilters>
    )
}
