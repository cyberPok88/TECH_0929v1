'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA COMPRA FILTERS — Filtros del listado de notas (Guía 1.4 · rediseño · Dumb)
// Compone CatalogoFilters + controles del dominio (PLAN NotasCompra):
// Proveedor · Estado físico (por_recibir/recibida) · Estado de pago
// (Por pagar/Pago parcial/Pagada) · Rango de fechas (fecha_nota).
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect, RangoFechas } from '@/components/data-table'
import type { FiltrosNotaCompra } from '@/types/notas-compra'
import {
    OPCIONES_ESTADO_PAGO_NOTA,
    TEXTO_ESTADO_FISICO,
    TEXTO_ESTADO_PAGO_NOTA,
} from '@/types/notas-compra'
import type { EstadoFisicoNota } from '@/types/notas-compra'

export interface OpcionFiltro {
    valor: string
    etiqueta: string
}

export const FILTROS_NOTAS_DEFAULT: FiltrosNotaCompra = {
    busqueda: '',
    idProveedor: '',
    estadoFisico: '',
    estadoPago: '',
    fechaDesde: '',
    fechaHasta: '',
}

const OPCIONES_ESTADO_FISICO: { valor: EstadoFisicoNota; etiqueta: string }[] = (
    ['por_recibir', 'recibida'] as const
).map((clave) => ({ valor: clave, etiqueta: TEXTO_ESTADO_FISICO[clave] }))

const OPCIONES_ESTADO_PAGO = OPCIONES_ESTADO_PAGO_NOTA.map((clave) => ({
    valor: clave,
    etiqueta: TEXTO_ESTADO_PAGO_NOTA[clave],
}))

interface NotaCompraFiltersProps {
    filtros: FiltrosNotaCompra
    onFiltrosChange: (patch: Partial<FiltrosNotaCompra>) => void
    proveedores: OpcionFiltro[]
    contador?: number
    disabled?: boolean
}

export function NotaCompraFilters({
    filtros,
    onFiltrosChange,
    proveedores,
    contador,
    disabled = false,
}: NotaCompraFiltersProps) {
    const hayFiltrosActivos =
        filtros.busqueda !== '' ||
        filtros.idProveedor !== '' ||
        filtros.estadoFisico !== '' ||
        filtros.estadoPago !== '' ||
        filtros.fechaDesde !== '' ||
        filtros.fechaHasta !== ''

    const limpiar = () => onFiltrosChange(FILTROS_NOTAS_DEFAULT)

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por folio o nº de factura…"
            contador={contador}
            sustantivoContador={{ singular: 'nota', plural: 'notas' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
        >
            <FiltroSelect
                label="Proveedor"
                opciones={proveedores}
                valor={filtros.idProveedor}
                onValorChange={(v) => onFiltrosChange({ idProveedor: v === '__todos__' ? '' : v })}
                disabled={disabled}
            />
            <FiltroSelect
                label="Estado físico"
                opciones={OPCIONES_ESTADO_FISICO}
                valor={filtros.estadoFisico}
                onValorChange={(v) =>
                    onFiltrosChange({
                        estadoFisico: (v === '__todos__' ? '' : v) as FiltrosNotaCompra['estadoFisico'],
                    })
                }
                disabled={disabled}
            />
            <FiltroSelect
                label="Estado de pago"
                opciones={OPCIONES_ESTADO_PAGO}
                valor={filtros.estadoPago}
                onValorChange={(v) =>
                    onFiltrosChange({
                        estadoPago: (v === '__todos__' ? '' : v) as FiltrosNotaCompra['estadoPago'],
                    })
                }
                disabled={disabled}
            />
            <RangoFechas
                desde={filtros.fechaDesde}
                hasta={filtros.fechaHasta}
                onDesdeChange={(v) => onFiltrosChange({ fechaDesde: v })}
                onHastaChange={(v) => onFiltrosChange({ fechaHasta: v })}
                disabled={disabled}
            />
        </CatalogoFilters>
    )
}
