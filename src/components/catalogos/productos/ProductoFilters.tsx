'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTO FILTERS — Filtros del listado (Guía 1.2 · Parte 2 · Dumb)
// Compone CatalogoFilters + controles del dominio: categoría (raíz y subs con ↳),
// marca, segmento de estado y toggle de pendientes de enriquecer.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'

import { CatalogoFilters, FiltroSelect } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CategoriaFila, MarcaProductoFila } from '@/types/catalogos'
import type { EstadoFiltroProducto, ProductoFiltros } from '@/types/productos'

export const FILTROS_DEFAULT: ProductoFiltros = {
    busqueda: '',
    id_categoria: '',
    id_marca: '',
    estado: 'activo',
    solo_pendientes: false,
}

const OPCIONES_ESTADO: { valor: EstadoFiltroProducto; etiqueta: string }[] = [
    { valor: 'activo', etiqueta: 'Activos' },
    { valor: 'archivados', etiqueta: 'Archivados' },
    { valor: 'todos', etiqueta: 'Todos' },
]

interface ProductoFiltersProps {
    filtros: ProductoFiltros
    onFiltrosChange: (patch: Partial<ProductoFiltros>) => void
    categorias: CategoriaFila[]
    marcas: MarcaProductoFila[]
    contador?: number
    disabled?: boolean
}

export function ProductoFilters({
    filtros,
    onFiltrosChange,
    categorias,
    marcas,
    contador,
    disabled = false,
}: ProductoFiltersProps) {
    const opcionesCategoria = useMemo(() => {
        const raices = categorias
            .filter((c) => !c.id_categoria_padre && c.es_activo)
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        const subs = categorias
            .filter((c) => c.id_categoria_padre && c.es_activo)
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        return [
            ...raices.map((r) => ({ valor: r.id, etiqueta: r.nombre })),
            ...subs.map((s) => ({ valor: s.id, etiqueta: `↳ ${s.nombre}` })),
        ]
    }, [categorias])

    const opcionesMarca = useMemo(
        () =>
            marcas
                .filter((m) => m.es_activo)
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((m) => ({ valor: m.id, etiqueta: m.nombre })),
        [marcas]
    )

    const hayFiltrosActivos =
        filtros.busqueda !== '' ||
        filtros.id_categoria !== '' ||
        filtros.id_marca !== '' ||
        filtros.estado !== 'activo' ||
        filtros.solo_pendientes

    const limpiar = () => onFiltrosChange(FILTROS_DEFAULT)

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por nombre, SKU o código de barras…"
            contador={contador}
            sustantivoContador={{ singular: 'producto', plural: 'productos' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
        >
            <FiltroSelect
                label="Categoría"
                opciones={opcionesCategoria}
                valor={filtros.id_categoria}
                onValorChange={(v) =>
                    onFiltrosChange({ id_categoria: v === '__todos__' ? '' : v })
                }
                disabled={disabled}
            />
            <FiltroSelect
                label="Marca"
                opciones={opcionesMarca}
                valor={filtros.id_marca}
                onValorChange={(v) =>
                    onFiltrosChange({ id_marca: v === '__todos__' ? '' : v })
                }
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
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Enriquecimiento</span>
                <Button
                    type="button"
                    variant={filtros.solo_pendientes ? 'default' : 'outline'}
                    disabled={disabled}
                    onClick={() => onFiltrosChange({ solo_pendientes: !filtros.solo_pendientes })}
                    className={cn(
                        'h-9 px-3 text-xs',
                        filtros.solo_pendientes && 'cursor-default'
                    )}
                >
                    Pendientes
                </Button>
            </div>
        </CatalogoFilters>
    )
}
