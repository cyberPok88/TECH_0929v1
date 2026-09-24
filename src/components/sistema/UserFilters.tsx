'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// USER FILTERS — Guía 0.9 · homogenizado 23 Ago 2026
//
// Compone el esqueleto `CatalogoFilters` (0.8 P8) con los controles específicos
// del dominio Usuarios en `children`:
//   1. Búsqueda texto (debounce 300ms — vive en el esqueleto)
//   2. Rol (select) — poblado desde el catálogo (frontera 0.10: solo lectura)
//   3. Estado (select) — Activos / Inactivos / Archivados / Todos
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
import type { FiltrosUsuario, RolOpcion, EstadoFiltro } from '@/types/usuarios'
import { CatalogoFilters } from '@/components/data-table'

interface UserFiltersProps {
    filtros: FiltrosUsuario
    roles: RolOpcion[]
    onFiltrosChange: (patch: Partial<FiltrosUsuario>) => void
    disabled?: boolean
    className?: string
}

const ESTADOS: { value: EstadoFiltro; label: string }[] = [
    { value: 'activo', label: 'Activos' },
    { value: 'inactivo', label: 'Inactivos' },
    { value: 'archivados', label: 'Archivados' },
    { value: 'todos', label: 'Todos' },
]

// Radix Select no admite <SelectItem value="">: "todos los roles" usa este
// centinela y el onChange lo mapea de vuelta a idRol ''.
const ROL_TODOS = '__todos__'

export function UserFilters({
    filtros,
    roles,
    onFiltrosChange,
    disabled,
    className,
}: UserFiltersProps) {
    const limpiar = () => {
        onFiltrosChange({ busqueda: '', idRol: '', estado: 'todos' })
    }

    const hayFiltrosActivos =
        filtros.busqueda !== '' || filtros.idRol !== '' || filtros.estado !== 'todos'

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(valor) => onFiltrosChange({ busqueda: valor })}
            placeholderBusqueda="Buscar por nombre o correo…"
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
            className={className}
        >
            {/* Rol — poblado desde el catálogo (frontera 0.10: solo lectura). */}
            <Select
                value={filtros.idRol === '' ? ROL_TODOS : filtros.idRol}
                onValueChange={(v) => onFiltrosChange({ idRol: v === ROL_TODOS ? '' : v })}
                disabled={disabled}
            >
                <SelectTrigger className="w-48" aria-label="Filtrar por rol">
                    <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ROL_TODOS}>Todos los roles</SelectItem>
                    {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                            {r.nombre}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Estado — default 'todos' (incluye archivados); 'archivados' es la papelera enfocada (MEJORA 20 Ago 2026). */}
            <Select
                value={filtros.estado}
                onValueChange={(v) => onFiltrosChange({ estado: v as EstadoFiltro })}
                disabled={disabled}
            >
                <SelectTrigger className="w-44" aria-label="Filtrar por estado">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    {ESTADOS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                            {e.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CatalogoFilters>
    )
}
