'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMNAS DE PLANTILLA + VOCABULARIO DE FAMILIA (Guía 2.1 · P3)
//
// El vocabulario de `familia` vive AQUÍ y no en cada pestaña: las dos pintan la
// misma píldora con los mismos textos, y duplicarlo sería «dos nombres para lo
// mismo» (ley L7). Precedente de exportar helpers compartidos desde un
// columnas-*.tsx: `columnas-entrada.tsx` (formatearFechaEntrada · huellaDeclarada).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ColumnDef } from '@tanstack/react-table'

import { Pildora } from '@/components/data-table'
import type { ColumnDefExtension } from '@/components/data-table'
import type { FamiliaDocumento, PlantillaDocumento } from '@/types/plantillas'

export type ColumnaPlantilla = ColumnDef<PlantillaDocumento> &
    ColumnDefExtension<PlantillaDocumento>

// ── Vocabulario de familia (compartido con la pestaña de tipos) ────────────────
export const TEXTO_FAMILIA: Record<FamiliaDocumento, string> = {
    interno: 'Interno',
    valor: 'Papel con valor',
}

/** ⚠️ Los tonos son los de `Pildora` — el color lo resuelve la paleta, no este archivo. */
export const TONO_FAMILIA: Record<FamiliaDocumento, 'neutro' | 'advertencia'> = {
    interno: 'neutro',
    valor: 'advertencia',
}

/** Fecha corta es-MX. Precedente: `formatearFechaEntrada` de columnas-entrada.tsx. */
export function formatearFechaPlantilla(fecha: string): string {
    if (!fecha) return '—'
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Columnas (checklist de consumo 0.8: label · movil · align) ─────────────────

export const columnaTipo: ColumnaPlantilla = {
    id: 'tipo',
    accessorFn: (p) => p.tipo_nombre ?? p.tipo_clave ?? '—',
    label: 'Tipo de documento',
    movil: 'critica',
}

export const columnaNombre: ColumnaPlantilla = {
    accessorKey: 'nombre',
    label: 'Nombre',
    movil: 'critica',
}

export const columnaFamilia: ColumnaPlantilla = {
    id: 'familia',
    accessorFn: (p) => p.familia,
    label: 'Familia',
    movil: 'secundaria',
    render: (value) => {
        if (!value) return <span className="text-muted-foreground">—</span>
        const f = value as FamiliaDocumento
        return <Pildora texto={TEXTO_FAMILIA[f]} tono={TONO_FAMILIA[f]} />
    },
}

export const columnaVersion: ColumnaPlantilla = {
    accessorKey: 'version',
    label: 'Versión',
    movil: 'secundaria',
    align: 'derecha',
    // Ley 6 — número que se compara verticalmente: mono + tabular-nums.
    render: (value) => (
        <span className="font-mono text-[13px] tabular-nums">v{String(value)}</span>
    ),
}

export const columnaEstadoPlantilla: ColumnaPlantilla = {
    accessorKey: 'es_activo',
    label: 'Estado',
    movil: 'critica',
    render: (value) => (
        <Pildora texto={value ? 'Activa' : 'Inactiva'} tono={value ? 'exito' : 'neutro'} />
    ),
}

export const columnaActualizado: ColumnaPlantilla = {
    accessorKey: 'updated_at',
    label: 'Última edición',
    movil: 'ocultar',
    render: (value) => (
        <span className="font-mono text-[13px] tabular-nums">
            {formatearFechaPlantilla(String(value))}
        </span>
    ),
}

/**
 * Las columnas de la parrilla, en orden. `es_activo` es la píldora de ESTADO
 * (redonda); el resto son datos.
 */
export const COLUMNAS_PLANTILLA: ColumnaPlantilla[] = [
    columnaTipo,
    columnaNombre,
    columnaFamilia,
    columnaVersion,
    columnaEstadoPlantilla,
    columnaActualizado,
]
