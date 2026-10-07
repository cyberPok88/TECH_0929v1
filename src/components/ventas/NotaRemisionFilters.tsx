'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA REMISION FILTERS — Filtros del listado de ventas (Guía 1.8 · Dumb)
// Compone CatalogoFilters + controles del dominio (PLAN Ventas §3):
// Cliente · Marca · Estado de pago · Rango de fechas (fecha_emision) +
// ⭐ «Solo con saldo» e «Incluir canceladas» (los dos que la operación usa a diario).
// ⚠️ El DTO de filtros va en camelCase y con '' = «todos»: NO son columnas de la BD.
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect, FiltroSwitch, RangoFechas } from '@/components/data-table'
import {
    ETIQUETA_ESTADO_PAGO,
    type ClaveEstadoPagoNota,
    type FiltrosNotaRemision,
} from '@/types/ventas'

export interface OpcionFiltro {
    valor: string
    etiqueta: string
}

export const FILTROS_VENTAS_DEFAULT: FiltrosNotaRemision = {
    busqueda: '',
    idCliente: '',
    idMarca: '',
    estadoPago: '',
    fechaDesde: '',
    fechaHasta: '',
    soloConSaldo: false,
    incluirCanceladas: false,
}

const CLAVES_ESTADO_PAGO: ClaveEstadoPagoNota[] = [
    'pendiente',
    'parcial',
    'pagada',
    'vencida',
    'cancelada',
]

const OPCIONES_ESTADO_PAGO = CLAVES_ESTADO_PAGO.map((clave) => ({
    valor: clave,
    etiqueta: ETIQUETA_ESTADO_PAGO[clave],
}))

interface NotaRemisionFiltersProps {
    filtros: FiltrosNotaRemision
    onFiltrosChange: (patch: Partial<FiltrosNotaRemision>) => void
    /** Opciones de cliente y marca — las carga el catálogo una sola vez. */
    clientes: OpcionFiltro[]
    marcas: OpcionFiltro[]
    contador?: number
    disabled?: boolean
}

export function NotaRemisionFilters({
    filtros,
    onFiltrosChange,
    clientes,
    marcas,
    contador,
    disabled = false,
}: NotaRemisionFiltersProps) {
    const hayFiltrosActivos =
        filtros.busqueda !== '' ||
        filtros.idCliente !== '' ||
        filtros.idMarca !== '' ||
        filtros.estadoPago !== '' ||
        filtros.fechaDesde !== '' ||
        filtros.fechaHasta !== '' ||
        filtros.soloConSaldo ||
        filtros.incluirCanceladas

    const limpiar = () => onFiltrosChange(FILTROS_VENTAS_DEFAULT)

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por folio…"
            contador={contador}
            sustantivoContador={{ singular: 'nota', plural: 'notas' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
        >
            <FiltroSelect
                label="Cliente"
                opciones={clientes}
                valor={filtros.idCliente}
                onValorChange={(v) => onFiltrosChange({ idCliente: v === '__todos__' ? '' : v })}
                disabled={disabled}
            />
            <FiltroSelect
                label="Marca"
                opciones={marcas}
                valor={filtros.idMarca}
                onValorChange={(v) => onFiltrosChange({ idMarca: v === '__todos__' ? '' : v })}
                disabled={disabled}
            />
            <FiltroSelect
                label="Estado de pago"
                opciones={OPCIONES_ESTADO_PAGO}
                valor={filtros.estadoPago}
                onValorChange={(v) =>
                    onFiltrosChange({
                        estadoPago: (v === '__todos__' ? '' : v) as FiltrosNotaRemision['estadoPago'],
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
            {/* ⭐ Los dos que la operación usa a diario: «lo que me deben» y volver a ver una cancelada */}
            <FiltroSwitch
                label="Solo con saldo"
                activo={filtros.soloConSaldo}
                onActivoChange={(soloConSaldo) => onFiltrosChange({ soloConSaldo })}
                disabled={disabled}
            />
            <FiltroSwitch
                label="Incluir canceladas"
                activo={filtros.incluirCanceladas}
                onActivoChange={(incluirCanceladas) => onFiltrosChange({ incluirCanceladas })}
                disabled={disabled}
            />
        </CatalogoFilters>
    )
}
