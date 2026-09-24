'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDOR FILTERS — Filtros del listado (Guía 1.1 · Parte 2 · Dumb)
// Compone el esqueleto CatalogoFilters (0.8) + controles del dominio:
//   · Select de tipo (formal/informal/eventual)
//   · Segmento de estado (Activos · Archivados · Todos) — PLAN §4 #9
// Sin lógica: recibe filtros y emite parches (patrón UserFilters 0.9).
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EstadoFiltroProveedor, FiltrosProveedor, TipoProveedor } from '@/types/proveedores'

const OPCIONES_TIPO: { valor: TipoProveedor; etiqueta: string }[] = [
    { valor: 'formal', etiqueta: 'Formal' },
    { valor: 'informal', etiqueta: 'Informal' },
    { valor: 'eventual', etiqueta: 'Eventual' },
]

const OPCIONES_ESTADO: { valor: EstadoFiltroProveedor; etiqueta: string }[] = [
    { valor: 'activo', etiqueta: 'Activos' },
    { valor: 'archivados', etiqueta: 'Archivados' },
    { valor: 'todos', etiqueta: 'Todos' },
]

export const FILTROS_DEFAULT: FiltrosProveedor = { busqueda: '', tipo: '', estado: 'activo' }

interface ProveedorFiltersProps {
    filtros: FiltrosProveedor
    onFiltrosChange: (patch: Partial<FiltrosProveedor>) => void
    contador?: number
    disabled?: boolean
}

export function ProveedorFilters({
    filtros,
    onFiltrosChange,
    contador,
    disabled = false,
}: ProveedorFiltersProps) {
    const hayFiltrosActivos =
        filtros.busqueda !== '' || filtros.tipo !== '' || filtros.estado !== 'activo'

    const limpiar = () => onFiltrosChange(FILTROS_DEFAULT)

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por nombre, RFC o código…"
            contador={contador}
            sustantivoContador={{ singular: 'proveedor', plural: 'proveedores' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
        >
            <FiltroSelect
                label="Tipo"
                opciones={OPCIONES_TIPO}
                valor={filtros.tipo}
                onValorChange={(v) => onFiltrosChange({ tipo: v === '__todos__' ? '' : (v as TipoProveedor) })}
                disabled={disabled}
            />
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Estado</span>
                <div className="flex overflow-hidden rounded-md border border-border">
                    {OPCIONES_ESTADO.map((opcion) => (
                        <Button
                            key={opcion.valor}
                            type="button"
                            variant={filtros.estado === opcion.valor ? 'default' : 'ghost'}
                            disabled={disabled}
                            onClick={() => onFiltrosChange({ estado: opcion.valor })}
                            className={cn(
                                'h-9 rounded-none px-3 text-xs',
                                filtros.estado === opcion.valor && 'cursor-default'
                            )}
                        >
                            {opcion.etiqueta}
                        </Button>
                    ))}
                </div>
            </div>
        </CatalogoFilters>
    )
}
