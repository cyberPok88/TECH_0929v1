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

// ⭐ MEJORA 26 Sep 2026 (contrato agregado) — EL CROMO DE TABLA, EN UN SOLO LUGAR.
// `BotonDespliegue`: el chevron con marco al hover, el MISMO en la fila de entrada y en la
// fila de partida. Las `CLASE_*`: la fuente única para que una tabla escrita a mano pinte
// el encabezado igual que el kit (era el origen de que hubiera tres maneras distintas).
export { BotonDespliegue } from "./BotonDespliegue"
export type { BotonDespliegueProps } from "./BotonDespliegue"
export {
    CLASE_CAJA_TABLA,
    CLASE_TABLA,
    CLASE_THEAD_TABLA,
    CLASE_TH_TABLA,
    CLASE_TH_KIT,
    CLASE_TD_FILA,
    CLASE_TBODY_KIT,
} from "./estilos-tabla"

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

// ⭐ MEJORA 26 Sep 2026 (contrato agregado) — FILTRO EN EL ENCABEZADO DE LA COLUMNA.
// El DataTable lo pinta; los CRUDs solo declaran `filtro` en su columna. `limpiarFiltroColumna`
// se exporta para que un CRUD pueda ofrecer «quitar» fuera del panel si lo necesita.
export { FiltroColumnaBoton, limpiarFiltroColumna } from "./filtros/FiltroColumna"

export type { TonoPildora } from "./celdas/Pildora"
export type { ChipFiltro } from "./filtros/CatalogoFilters"

// Tipos del contrato (re-export desde types/table.ts)
export type {
    DataTableProps,
    RowAction,
    PageSizeOption,
    EstadoTabla,
    ColumnDefExtension,
    ToolbarContext,
    SeleccionTabla,
    FiltroColumna,
    OpcionFiltroColumna,
} from "@/types/table"
