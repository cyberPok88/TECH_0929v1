'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLA FILTERS — barra de filtros del módulo (Guía 2.1 · 27 Sep 2026)
//
// ⭐ COMPARTIDA por las DOS pestañas del módulo (Tipos de documento y Plantillas):
// el vocabulario es el mismo — busqueda · familia · esActivo (PLAN §1.6).
// Compone el esqueleto `CatalogoFilters` (kit 0.8 P8) y aporta los controles del
// dominio en `children`.
//
// Contrato unificado de la familia: { filtros, onFiltrosChange, disabled?, className? }
// Dumb: cero stores, cero Server Actions, cero router.
// ═══════════════════════════════════════════════════════════════════════════════

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { CatalogoFilters } from '@/components/data-table'
import type { FamiliaDocumento, FiltrosPlantillas } from '@/types/plantillas'

interface PlantillaFiltersProps {
    filtros: FiltrosPlantillas
    onFiltrosChange: (patch: Partial<FiltrosPlantillas>) => void
    disabled?: boolean
    className?: string
    /** Texto del buscador — la pestaña lo ajusta (tipos busca por clave/nombre; plantillas por nombre). */
    placeholderBusqueda?: string
}

const FAMILIAS: { value: FamiliaDocumento | ''; label: string }[] = [
    { value: '', label: 'Todas las familias' },
    { value: 'interno', label: 'Interno' },
    { value: 'valor', label: 'Papel con valor' },
]

const ESTADOS: { value: FiltrosPlantillas['esActivo']; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'activos', label: 'Activos' },
    { value: 'inactivos', label: 'Inactivos' },
]

export function PlantillaFilters({
    filtros,
    onFiltrosChange,
    disabled,
    className,
    placeholderBusqueda = 'Buscar…',
}: PlantillaFiltersProps) {
    const limpiar = () => {
        onFiltrosChange({ busqueda: '', familia: '', esActivo: '' })
    }

    const hayFiltrosActivos =
        filtros.busqueda !== '' || filtros.familia !== '' || filtros.esActivo !== ''

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(valor) => onFiltrosChange({ busqueda: valor })}
            placeholderBusqueda={placeholderBusqueda}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            disabled={disabled}
            className={className}
        >
            {/* Familia — interno (acto interno) vs valor (papel que sale de la empresa). */}
            <Select
                value={filtros.familia}
                onValueChange={(v) => onFiltrosChange({ familia: v as FamiliaDocumento | '' })}
                disabled={disabled}
            >
                <SelectTrigger className="w-56" aria-label="Filtrar por familia">
                    <SelectValue placeholder="Familia" />
                </SelectTrigger>
                <SelectContent>
                    {FAMILIAS.map((f) => (
                        <SelectItem key={f.value || 'todas'} value={f.value || 'todas-familias'}>
                            {f.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Estado — 3 opciones: un Switch tendría solo 2 y hace falta «todos». */}
            <Select
                value={filtros.esActivo}
                onValueChange={(v) => onFiltrosChange({ esActivo: v as FiltrosPlantillas['esActivo'] })}
                disabled={disabled}
            >
                <SelectTrigger className="w-40" aria-label="Filtrar por estado">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    {ESTADOS.map((e) => (
                        <SelectItem key={e.value || 'todos'} value={e.value || 'todos-estados'}>
                            {e.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CatalogoFilters>
    )
}
