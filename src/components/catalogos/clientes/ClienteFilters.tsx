'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTE FILTERS — Filtros del listado (Guía 1.3 · Parte 2 · Dumb)
// Compone el esqueleto CatalogoFilters (0.8) + controles del dominio:
//   · Select de Marca (de marcas_comerciales activas)
//   · Select de Tipo (segmento, de tipos_cliente)
//   · Select de Vendedor (cartera — derivado de usuarios rol vendedor)
//   · Segmento de estado (Todos · Activos · Suspendidos · Archivados) — PLAN §4
// El DEFAULT es 'todos' (decisión usuario 04 Sep — difiere del precedente 1.1/1.2).
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EstadoFiltroCliente, FiltrosCliente } from '@/types/clientes'

export interface OpcionFiltro {
    valor: string
    etiqueta: string
}

export interface ClienteFilterOpciones {
    marcas: OpcionFiltro[]
    tipos: OpcionFiltro[]
    vendedores: OpcionFiltro[]
}

export const FILTROS_DEFAULT: FiltrosCliente = {
    busqueda: '',
    id_marca_comercial: '',
    id_tipo_cliente: '',
    id_vendedor_asignado: '',
    estado: 'todos',
}

const OPCIONES_ESTADO: { valor: EstadoFiltroCliente; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: 'Todos' },
    { valor: 'activos', etiqueta: 'Activos' },
    { valor: 'suspendidos', etiqueta: 'Suspendidos' },
    { valor: 'archivados', etiqueta: 'Archivados' },
]

interface ClienteFiltersProps {
    filtros: FiltrosCliente
    onFiltrosChange: (patch: Partial<FiltrosCliente>) => void
    opciones: ClienteFilterOpciones
    contador?: number
    disabled?: boolean
}

export function ClienteFilters({
    filtros,
    onFiltrosChange,
    opciones,
    contador,
    disabled = false,
}: ClienteFiltersProps) {
    const hayFiltrosActivos =
        filtros.busqueda !== '' ||
        filtros.id_marca_comercial !== '' ||
        filtros.id_tipo_cliente !== '' ||
        filtros.id_vendedor_asignado !== '' ||
        filtros.estado !== 'todos'

    const limpiar = () => onFiltrosChange(FILTROS_DEFAULT)

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por nombre, código o RFC…"
            contador={contador}
            sustantivoContador={{ singular: 'cliente', plural: 'clientes' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
        >
            <FiltroSelect
                label="Marca"
                opciones={opciones.marcas}
                valor={filtros.id_marca_comercial}
                onValorChange={(v) =>
                    onFiltrosChange({ id_marca_comercial: v === '__todos__' ? '' : v })
                }
                disabled={disabled}
            />
            <FiltroSelect
                label="Tipo"
                opciones={opciones.tipos}
                valor={filtros.id_tipo_cliente}
                onValorChange={(v) =>
                    onFiltrosChange({ id_tipo_cliente: v === '__todos__' ? '' : v })
                }
                disabled={disabled}
            />
            <FiltroSelect
                label="Vendedor"
                opciones={opciones.vendedores}
                valor={filtros.id_vendedor_asignado}
                onValorChange={(v) =>
                    onFiltrosChange({ id_vendedor_asignado: v === '__todos__' ? '' : v })
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
        </CatalogoFilters>
    )
}
