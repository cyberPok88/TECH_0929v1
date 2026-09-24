// ═══════════════════════════════════════════════════════════════════════════════
// BARREL data-table — API pública de la familia (Guía 0.8)
// Los CRUDs importan SOLO desde aquí (convención 0.6: components/shell/index.ts)
// ⭐ REDISEÑO 02 Sep 2026 — subcarpetas: columnas/ · celdas/ · filtros/ · hooks/
// ═══════════════════════════════════════════════════════════════════════════════

export { DataTable } from "./DataTable"
export { TableSkeleton } from "./TableSkeleton"
export { Pagination } from "./Pagination"
export { ColumnSelector } from "./ColumnSelector"
export { ConfirmDialog } from "./ConfirmDialog"

// ⭐ REDISEÑO 02 Sep 2026 — piezas nuevas de la familia (Parte 2 · B5/B6)
export { crearColumnaAcciones } from "./columnas/crearColumnaAcciones"   // PROMOCIÓN
export { useSeleccionTabla } from "./hooks/useSeleccionTabla"            // NACE

// ⭐ Parte 5 (contrato agregado 12 Ago 2026) — píldora de estado genérica
export { Pildora } from "./celdas/Pildora"          // Parte 5 (contrato agregado 12 Ago 2026)
export { CatalogoFilters } from "./filtros/CatalogoFilters"   // Parte 8 (contrato agregado 23 Ago 2026) · REDISEÑO 02 Sep: vive en filtros/

// ⭐ Parte 9 (contrato agregado 01 Sep 2026) — kit de controles de filtro
export { FiltroBusqueda } from "./filtros/FiltroBusqueda"   // Parte 9 · kit de filtros (contrato agregado 01 Sep 2026)
export { FiltroSelect } from "./filtros/FiltroSelect"
export { FiltroMultiselect } from "./filtros/FiltroMultiselect"
export { FiltroSwitch } from "./filtros/FiltroSwitch"
export { RangoFechas } from "./filtros/RangoFechas"
export { SegmentedControl } from "./filtros/SegmentedControl"

export type { TonoPildora } from "./celdas/Pildora"

// Tipos del contrato (re-export desde types/table.ts)
export type {
    DataTableProps,
    RowAction,
    PageSizeOption,
    EstadoTabla,
    ColumnDefExtension,
    ToolbarContext,
    SeleccionTabla,
} from "@/types/table"
