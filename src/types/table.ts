// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL SISTEMA DE TABLAS — Guía 0.8
// Contrato TypeScript puro — sin dependencias del dominio de negocio
// Consumido por: DataTable, Pagination, ColumnSelector, ConfirmDialog, CRUDs 1.0+
// ⭐ REDISEÑO 02 Sep 2026: label/align/movil/fijaDerecha/fijaIzquierda · densidad ·
//   alturaMaxima (sticky header) · SeleccionTabla<T> (hook useSeleccionTabla)
// ═══════════════════════════════════════════════════════════════════════════════

import type {
    ColumnDef,
    SortingState,
    ColumnFiltersState,
    OnChangeFn,
} from "@tanstack/react-table"
import type { LucideIcon } from "lucide-react"

/**
 * Opciones de filas por página para el selector del Pagination.
 * Cada CRUD define su array (ej: [10, 20, 50, 100] o [5, 10, 25] para móvil).
 */
export interface PageSizeOption {
    value: number
    label: string
}

/**
 * Estado de la tabla — tres valores mutuamente excluyentes.
 * El CRUD pasa uno solo; la tabla ramifica:
 *   - idle: render normal
 *   - loading: TableSkeleton
 *   - error: bloque error + botón Reintentar (si onRetry)
 */
export type EstadoTabla = "idle" | "loading" | "error"

/**
 * Extensión de ColumnDef de TanStack (⭐ REDISEÑO 02 Sep 2026).
 * `visible` controla si la columna aparece en ColumnSelector (default: true).
 * `render` opcional — si no se define, muestra String(value ?? "—") (Decisión 11).
 * `label` opcional — etiqueta del header; si no se define se usa String(accessorKey).
 * `align` — 'izquierda' (default) | 'centro' | 'derecha' (numéricos: derecha + mono).
 * `movil` — prioridad en <768px (spec R4): 'critica' se conserva · 'secundaria' se
 *   colapsa a ancho mínimo · 'ocultar' se oculta.
 * `fijaDerecha`/`fijaIzquierda` — columna sticky en scroll horizontal (R1); la columna
 *   de acciones (crearColumnaAcciones) es fijaDerecha por contrato.
 */
export interface ColumnDefExtension<TData = unknown> {
    visible?: boolean
    render?: (value: unknown, row: TData) => React.ReactNode
    label?: string
    align?: "izquierda" | "centro" | "derecha"
    movil?: "critica" | "secundaria" | "ocultar"
    fijaDerecha?: boolean
    fijaIzquierda?: boolean
}

/**
 * Acción inline por fila — renderizada en la columna de acciones.
 * El CRUD define el array y ENVUELVE onClick con ProtectedAction/useCanAction (0.7).
 * La tabla solo renderiza el icono + label + maneja el click.
 */
export interface RowAction<TData = unknown> {
    /** Icono de lucide-react (ej: Edit, Trash2, Eye) */
    icon: LucideIcon
    /** Texto para tooltip/accesibilidad */
    label: string
    /** Variant del botón (ghost/destructive/outline) */
    variant?: "ghost" | "destructive" | "outline"
    /** Handler — recibe la fila completa. El CRUD decide permisos. */
    onClick: (row: TData) => void
    /** Deshabilita el botón: booleano estático (ej: fila en proceso) o predicado
     *  por fila (⭐ ANEXIÓN 02 Sep 2026 — primer consumidor real: Guía 0.9 ·
     *  patrón "no te operes a ti mismo": (u) => u.id === usuarioSesionId). */
    disabled?: boolean | ((row: TData) => boolean)
    /** Atributo data-accion para las pruebas (patrón 0.9+) */
    dataAccion?: string
}

/**
 * Props principales del DataTable genérico.
 * T = tipo de fila del dominio (ej: Producto, Cliente, NotaRemision).
 *
 * MODO LOCAL (default): pasa solo `data` y `columns` → la tabla pagina/ordena/filtra localmente.
 * MODO SERVIDOR: pasa `page` + `pageSize` + `totalPages` + `onPageChange` →
 *   la tabla DESCONECTA su paginado interno y delega al padre (CRUD con Server Action).
 *   Sorting/filtering remotos: ANEXIÓN futura (Parte 5+) — hoy no implementados.
 */
export interface DataTableProps<TData = unknown> {
    /** Columnas — usan ColumnDef de TanStack + extensión (visible/render/label/align/movil/fija) */
    columns: (ColumnDef<TData> & ColumnDefExtension<TData>)[]

    /** Datos a mostrar — array completo (modo local) o página actual (modo servidor) */
    data: TData[]

    /** Función obligatoria que retorna identificador único estable por fila.
     *  NO usar índice del array (key={idx} rompe selección/sorting/animaciones).
     *  Ej: (row) => row.id  |  (row) => row.clave  |  (row) => row.folio */
    rowKey: (row: TData) => string | number

    /** Estado de la tabla: idle | loading | error */
    estado?: EstadoTabla

    /** Mensaje cuando data está vacía (estado idle) */
    emptyMessage?: string

    /** Callback al hacer click en Reintentar (estado error) */
    onRetry?: () => void

    // ── PAGINACIÓN DUAL (Decisión 5) ──

    /** Tamaño de página actual (default: 20) */
    pageSize?: number

    /** Opciones para el selector de pageSize (default: [10, 20, 50, 100]) */
    pageSizeOptions?: PageSizeOption[]

    // Modo LOCAL (no pasar estos 4): paginación automática sobre data[]
    // Modo SERVIDOR (pasar los 4): tabla desconecta paginado interno
    /** Página actual (base 1) — solo modo servidor */
    page?: number
    /** Total de páginas — solo modo servidor */
    totalPages?: number
    /** Callback cambio de página — solo modo servidor */
    onPageChange?: (page: number) => void
    /** Callback cambio de pageSize — ambos modos */
    onPageSizeChange?: (pageSize: number) => void

    // ── SORTING / FILTERING (solo modo local por ahora) ──

    /** Estado de ordenamiento (TanStack) — controlado opcionalmente */
    sorting?: SortingState
    /** Callback cambio de orden — solo modo local controlado (Updater de TanStack: valor o función) */
    onSortingChange?: OnChangeFn<SortingState>

    /** Estado de filtros de columna (TanStack) — controlado opcionalmente */
    columnFilters?: ColumnFiltersState
    /** Callback cambio de filtros — solo modo local controlado (Updater de TanStack: valor o función) */
    onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>

    // ── VISIBILIDAD DE COLUMNAS (persiste en localStorage via ColumnSelector) ──

    /** Columnas visibles actuales (base: accessorKey de ColumnDef) */
    visibleColumns?: string[]
    /** Callback cambio de visibilidad — ColumnSelector lo llama */
    onVisibleColumnsChange?: (columns: string[]) => void
    /** MEJORA 23 Ago 2026 — columnas visibles por defecto en la PRIMERA visita
     *  (antes de que exista localStorage). El selector sigue permitiendo
     *  mostrar/ocultar después. Default: todas. */
    defaultVisibleColumns?: string[]

    // ── ACCIONES POR FILA (Decisión 9) ──
    // ⚠️ REDISEÑO 02 Sep 2026 — DEPRECADO-COMPAT (0.9/0.10 lo usan).
    // El patrón recomendado es `crearColumnaAcciones` (data-table/columnas/).
    // El DataTable sigue renderizándolo con <th> "Acciones" (hueco cerrado).

    /** Acciones inline por fila — el CRUD las envuelve con ProtectedAction/useCanAction */
    renderRowActions?: (row: TData) => React.ReactNode

    // ── SELECCIÓN DE FILAS (ANEXIÓN 19 Ago 2026 — patrón SAE) ──

    /** Habilita la columna de checkboxes (header select-all + fila) y la selección múltiple. Default: false */
    enableRowSelection?: boolean
    /** Selección controlada: Record<rowKey, true> — opcional, si no se pasa es estado interno */
    rowSelection?: Record<string, boolean>
    /** Callback de cambio de selección (modo controlado) */
    onRowSelectionChange?: (selection: Record<string, boolean>) => void
    /** Toolbar de acciones masivas — se renderiza sobre la tabla cuando hay filas seleccionadas */
    renderToolbar?: (ctx: ToolbarContext<TData>) => React.ReactNode

    // ── ESTILOS / OVERRIDES ──

    /** className adicional para el contenedor de la tabla */
    className?: string

    /** ¿Mostrar ColumnSelector en la barra superior? (default: true) */
    showColumnSelector?: boolean

    // ── REDISEÑO 02 Sep 2026 ──

    /** Densidad: 'normal' (default) | 'compacto'. Es el OVERRIDE explícito;
     *  el default responde al breakpoint (R2 · Ley 5: h-11 md:h-[34px]). */
    densidad?: "normal" | "compacto"

    /** Altura máxima del contenedor (CSS) — activa el scroll vertical y el sticky
     *  header (R1/R6). Ej: "360px". Sin ella, la tabla crece con su contenido. */
    alturaMaxima?: string

    /** ⭐ PROMOCIÓN 20 Sep 2026 (Guía 1.6 Entradas → kit 0.8) — FILA EXPANDIBLE.
     *  Si se pasa, cada fila muestra un chevron y al expandir renderiza este
     *  contenido en un `<tr>` adicional a todo lo ancho. Genérico y presentacional:
     *  la tabla NO sabe de negocio; el consumidor decide qué mostrar (p. ej. las
     *  partidas/piezas de una entrada). Consumidores: 1.6 Entradas ·
     *  1.4 Notas de compra (futuro) · 1.8 Ventas (futuro). */
    renderFilaExpandida?: (row: TData) => React.ReactNode

    /** ⭐ MEJORA 20 Sep 2026 (usuario) — alineación por defecto de los DATOS de la tabla.
     *  Default `'centro'`: el usuario pidió centrar los datos en todas las tablas
     *  (sus encabezados ya salían centrados por el default del navegador y los datos
     *  quedaban a la izquierda). El `align?` de cada columna GANA sobre este default. */
    alineacionDatos?: "izquierda" | "centro" | "derecha"
}

/**
 * Contexto que recibe renderToolbar cuando hay filas seleccionadas (ANEXIÓN 19 Ago 2026).
 * El CRUD define las acciones masivas; la tabla provee la selección.
 */
export interface ToolbarContext<TData = unknown> {
    /** Filas seleccionadas (objetos completos, resueltos contra `data`) */
    selected: TData[]
    /** Claves seleccionadas (los rowKey) */
    selectedKeys: string[]
    /** Limpia la selección actual */
    clearSelection: () => void
}

/**
 * Contrato del hook `useSeleccionTabla` (⭐ NACE 02 Sep 2026 · data-table/hooks/).
 * Estado de selección UNIFORME para todos los CRUDs — mata la divergencia
 * (selectedKeys en 0.10 · seleccion en 1.0/1.2/1.3 · selectedIds.reduce en 1.1).
 * El CRUD pasa `seleccion` y `onSeleccionChange` al DataTable (modo controlado).
 */
export interface SeleccionTabla<TData = unknown> {
    /** Record<rowKey, true> — prop `rowSelection` del DataTable */
    seleccion: Record<string, boolean>
    /** Callback — prop `onRowSelectionChange` del DataTable */
    onSeleccionChange: (selection: Record<string, boolean>) => void
    /** rowKeys seleccionados (Object.keys(seleccion)) */
    claves: string[]
    /** Filas completas seleccionadas, resueltas contra `filas` */
    seleccionados: TData[]
    /** Alterna una fila por su rowKey */
    alternar: (row: TData) => void
    /** Limpia la selección */
    limpiar: () => void
}
