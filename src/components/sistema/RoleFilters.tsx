'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE FILTERS — Guía 0.10 · homogenizado 23 Ago 2026
//
// Compone el esqueleto `CatalogoFilters` (0.8 P8) con los controles específicos
// del dominio Roles en `children`:
//   1. Búsqueda texto (debounce 300ms — vive en el esqueleto)
//   2. Tipo (select) — Todos / Sistema / Personalizado
//
// Contrato unificado de la familia: { filtros, onFiltrosChange, disabled?, className? }
// ═══════════════════════════════════════════════════════════════════════════════

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { FiltrosRoles, TipoFiltro } from '@/types/roles'
import { CatalogoFilters } from '@/components/data-table'

interface RoleFiltersProps {
    filtros: FiltrosRoles
    onFiltrosChange: (patch: Partial<FiltrosRoles>) => void
    disabled?: boolean
    className?: string
}

const TIPOS: { value: TipoFiltro; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'sistema', label: 'Sistema' },
    { value: 'personalizado', label: 'Personalizado' },
]

export function RoleFilters({
    filtros,
    onFiltrosChange,
    disabled,
    className,
}: RoleFiltersProps) {
    const limpiar = () => {
        onFiltrosChange({ busqueda: '', tipo: 'todos' })
    }

    const hayFiltrosActivos = filtros.busqueda !== '' || filtros.tipo !== 'todos'

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(valor) => onFiltrosChange({ busqueda: valor })}
            placeholderBusqueda="Buscar por nombre…"
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
            className={className}
        >
            {/* Tipo — Sistema = es_sistema true (rol de semilla). */}
            <Select
                value={filtros.tipo}
                onValueChange={(v) => onFiltrosChange({ tipo: v as TipoFiltro })}
                disabled={disabled}
            >
                <SelectTrigger className="w-44" aria-label="Filtrar por tipo">
                    <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                    {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                            {t.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CatalogoFilters>
    )
}
