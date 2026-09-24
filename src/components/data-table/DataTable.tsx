"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// DATATABLE<T> — Wrapper Dumb sobre TanStack Core
// Guía 0.8 — Sort, filter, pagination (local/servidor), skeleton, empty, error, rowActions
// Estado interno: sorting, filtering, columnVisibility (TanStack).
// Controlado opcional: page/pageSize/totalPages/onPageChange (modo servidor).
// rowKey obligatorio. renderRowActions (⚠️ deprecado-compat) → CRUD envuelve con
// ProtectedAction/useCanAction (0.7); el patrón es crearColumnaAcciones (B5).
// ⭐ REDISEÑO 02 Sep 2026: densidad por breakpoint (R2) · sticky (R1) · movil (R4) · alturaMaxima.
// ═══════════════════════════════════════════════════════════════════════════════

import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    type Column,
    type ColumnDef,
    type Cell,
    type CellContext,
    type Header,
    type RowSelectionState,
    type SortingState,
    type PaginationState,
    type VisibilityState,
} from "@tanstack/react-table"
import { Fragment, useMemo, useState, useSyncExternalStore } from "react"

import { TableSkeleton } from "./TableSkeleton"
import { Pagination } from "./Pagination"
import { ColumnSelector } from "./ColumnSelector"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { AlertCircle, Loader2, ChevronUp, ChevronDown, ChevronRight, Minus } from "lucide-react"
import type {
    DataTableProps,
    ColumnDefExtension,
} from "@/types/table"

// ⭐ REDISEÑO 02 Sep 2026 — media query para R2 (densidad por breakpoint · Ley 5)
// y R4 (prioridades de columna en móvil). Patrón anti-bucle de la 0.7 (D12):
// cero setState en efectos — useSyncExternalStore (igual que RBACGuard).
function useMediaQuery(consulta: string): boolean {
    return useSyncExternalStore(
        (callback) => {
            const mq = window.matchMedia(consulta)
            mq.addEventListener("change", callback)
            return () => mq.removeEventListener("change", callback)
        },
        () => window.matchMedia(consulta).matches,
        () => false
    )
}

export function DataTable<TData>({
    columns: userColumns,
    data,
    rowKey,
    estado = "idle",
    emptyMessage = "Sin resultados",
    onRetry,
    pageSize = 20,
    pageSizeOptions,
    // Modo servidor (controlado)
    page,
    totalPages,
    onPageChange,
    onPageSizeChange,
    // Controlados opcionales (local)
    sorting,
    onSortingChange,
    columnFilters,
    onColumnFiltersChange,
    visibleColumns,
    onVisibleColumnsChange,
    defaultVisibleColumns,
    renderRowActions,
    // Selección de filas (ANEXIÓN 19 Ago 2026 — patrón SAE)
    enableRowSelection,
    rowSelection,
    onRowSelectionChange,
    renderToolbar,
    className,
    showColumnSelector = true,
    // ⭐ REDISEÑO 02 Sep 2026
    densidad,
    alturaMaxima,
    // ⭐ PROMOCIÓN 20 Sep 2026 — fila expandible (Guía 1.6 Entradas → kit 0.8)
    renderFilaExpandida,
    // ⭐ MEJORA 20 Sep 2026 — alineación de los DATOS (default: centrado)
    alineacionDatos = "centro",
}: DataTableProps<TData>) {
    // ⭐ R2: el DEFAULT responde al breakpoint (Ley 5 — 44px táctil / 34px denso en
    // escritorio); la prop `densidad` es el OVERRIDE explícito del usuario.
    // (R4 se resuelve con clases CSS por `movil` — no necesita estado JS.)
    const esEscritorio = useMediaQuery("(min-width: 768px)")
    const densidadEfectiva = densidad ?? (esEscritorio ? "compacto" : "normal")
    // ══════════════════════════════════════════════════════════════════════════════
    // MODO: ¿Local automático o servidor controlado?
    // ══════════════════════════════════════════════════════════════════════════════
    const isServerMode = page !== undefined && totalPages !== undefined && onPageChange !== undefined

    // ══════════════════════════════════════════════════════════════════════════════
    // VISIBILIDAD DE COLUMNAS (FIX 19 Ago 2026)
    // El selector debe operar SIEMPRE con un setter real. Si el padre no controla,
    // DataTable es el dueño del estado y persiste en localStorage (Decisión 8).
    // ═══════════════════════════════════════════════════════════════════════════════
    const isVisibilityControlled =
        visibleColumns !== undefined && onVisibleColumnsChange !== undefined

    const visibilityStorageKey =
        typeof window !== "undefined"
            ? `erp-table-columns-${window.location.pathname}`
            : "erp-table-columns"

    const [internalVisible, setInternalVisible] = useState<string[] | null>(() => {
        if (isVisibilityControlled) return null
        try {
            const raw = window.localStorage.getItem(visibilityStorageKey)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed as string[]
                }
            }
        } catch {
            // JSON corrupto → ignorar silenciosamente (mismo patrón que ColumnSelector)
        }
        // MEJORA 23 Ago 2026 — columnas críticas por defecto por tabla: el CRUD
        // puede pasar `defaultVisibleColumns` (p. ej. solo las críticas) que se
        // usa en la PRIMERA visita, antes de que exista localStorage. El usuario
        // sigue pudiendo mostrar/ocultar con el selector después.
        if (defaultVisibleColumns && defaultVisibleColumns.length > 0) {
            return defaultVisibleColumns
        }
        return null
    })

    function handleVisibleChange(next: string[]) {
        if (isVisibilityControlled) {
            onVisibleColumnsChange?.(next)
        } else {
            setInternalVisible(next)
            try {
                window.localStorage.setItem(visibilityStorageKey, JSON.stringify(next))
            } catch {
                // storage lleno/bloqueado → la sesión sigue funcionando
            }
        }
    }

    // ── SELECCIÓN DE FILAS (ANEXIÓN 19 Ago 2026 — patrón SAE) ──
    const [internalSelection, setInternalSelection] = useState<Record<string, boolean>>({})

    // ⭐ PROMOCIÓN 20 Sep 2026 — filas expandidas (fila expandible genérica).
    // Estado interno por rowKey; el consumidor solo aporta el contenido.
    const [filasExpandidas, setFilasExpandidas] = useState<Record<string, boolean>>({})
    const alternarExpandida = (clave: string) =>
        setFilasExpandidas((prev) => ({ ...prev, [clave]: !prev[clave] }))
    const isSelectionControlled =
        enableRowSelection && rowSelection !== undefined && onRowSelectionChange !== undefined
    const effectiveSelection = isSelectionControlled ? rowSelection! : internalSelection

    function handleSelectionChange(updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) {
        const next = typeof updater === "function" ? updater(effectiveSelection) : updater
        if (isSelectionControlled) {
            onRowSelectionChange?.(next)
        } else {
            setInternalSelection(next)
        }
    }

    // ── SORTING (FIX 19 Ago 2026) ──
    // TanStack maneja el sort por estado INTERNO cuando no se pasa onSortingChange,
    // pero React Compiler (Next 16) no puede compilar useReactTable y ese estado
    // interno no re-renderiza (warning react-hooks/incompatible-library histórico).
    // Solución: controlarlo SIEMPRE desde nuestro useState — el mismo patrón que
    // ya funciona para rowSelection y columnVisibility en esta tabla.
    const [internalSorting, setInternalSorting] = useState<SortingState>([])
    const isSortingControlled =
        sorting !== undefined && onSortingChange !== undefined
    const effectiveSorting = isSortingControlled ? sorting! : internalSorting

    function handleSortingChange(updater: SortingState | ((old: SortingState) => SortingState)) {
        const next = typeof updater === "function" ? updater(effectiveSorting) : updater
        if (isSortingControlled) {
            onSortingChange!(next)
        } else {
            setInternalSorting(next)
        }
    }

    // ── PAGINACIÓN LOCAL (FIX 19 Ago 2026) ──
    // El mismo problema que el sort: el state.pagination siempre presente sin
    // onPaginationChange dejaba la paginación controlada SIN setter → congelada.
    // En modo local la manejamos con nuestro useState; en modo servidor el padre
    // controla (page/pageSize/totalPages/onPageChange) — ver Pagination.
    const [internalPagination, setInternalPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize,
    })
    const effectivePagination = isServerMode
        ? { pageIndex: (page ?? 1) - 1, pageSize }
        : internalPagination

    function handlePaginationChange(updater: PaginationState | ((old: PaginationState) => PaginationState)) {
        const next = typeof updater === "function" ? updater(effectivePagination) : updater
        setInternalPagination(next)
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // COLUMNAS: extiende ColumnDef de TanStack con visible/render (ColumnDefExtension)
    // ═══════════════════════════════════════════════════════════════════════════════
    const columns = useMemo(() => {
        return userColumns.map((col) => {
            // accessorKey solo existe en la variante con accessor de la union ColumnDef<TData>
            // (ColumnDefDataAccessor) — se accede con cast estructural SIN any (no-explicit-any es error)
            const ext = col as ColumnDef<TData> & ColumnDefExtension<TData> & { accessorKey?: string }
            const accessorKey = ext.accessorKey ?? ext.id

            // Render por defecto: String(value ?? "—") (Decisión 11)
            // Recibe el contexto oficial CellContext<TData, unknown> — necesita row.original para render
            const originalCell = ext.cell
            const defaultCell = (info: CellContext<TData, unknown>) => {
                const value = info.getValue()
                return ext.render
                    ? ext.render(value, info.row.original)
                    : String(value ?? "—")
            }

            return {
                ...ext,
                cell: originalCell ?? defaultCell,
                // ⭐ Header rediseñado (Decisión 17 · REDISEÑO 02 Sep 2026): SIN botón muerto.
                // El <th> es el objetivo del click (onClick con handleSortToggle en el th).
                // El label usa `ext.label` (limpio) o el fallback String(accessorKey).
                header: ext.header ?? (() => {
                    const label = ext.label ?? String(accessorKey ?? ext.id ?? "Columna")
                    return <span className="truncate">{label}</span>
                }),
            } as ColumnDef<TData>
        })
    }, [userColumns])

    // ══════════════════════════════════════════════════════════════════════════════
    // MAPA DE VISIBILIDAD PARA TANSTACK (FIX 19 Ago 2026)
    // TanStack consume columnVisibility como Record<columnId, boolean> — lo derivamos
    // desde la lista efectiva de columnas visibles (controlado > interno > todas).
    // ═══════════════════════════════════════════════════════════════════════════════

    // Columnas elegibles del selector: excluye visible === false de la extensión
    // (el usuario no puede ocultar acciones — contrato Parte 3).
    const selectableColumnKeys = useMemo(
        () =>
            columns
                .filter((col) => {
                    const ext = col as ColumnDef<TData> & ColumnDefExtension<TData>
                    return ext.visible !== false
                })
                .map((col) =>
                    String(
                        (col as ColumnDef<TData> & ColumnDefExtension<TData> & { accessorKey?: string })
                            .accessorKey ?? col.id
                    )
                )
                .filter(Boolean),
        [columns]
    )

    // ⭐ FIX 20 Ago 2026 — claves obsoletas en localStorage dejaban TODO oculto al
    // recargar: si la persistencia guardó claves que ya no matchean las columnas
    // actuales (cambio de accessorKey, ruta reutilizada, selector desmarcado todo),
    // effectiveVisible no incluía ninguna columna real → la tabla "aparecía vacía"
    // aunque los datos estaban. Se filtran las claves contra las columnas reales;
    // si el filtrado queda vacío se cae a TODAS visibles (primera vez).
    const effectiveVisible = useMemo(() => {
        if (isVisibilityControlled) {
            return visibleColumns ?? selectableColumnKeys
        }
        const candidatas = internalVisible ?? selectableColumnKeys
        const validas = candidatas.filter((k) => selectableColumnKeys.includes(k))
        return validas.length > 0 ? validas : selectableColumnKeys
    }, [isVisibilityControlled, visibleColumns, internalVisible, selectableColumnKeys])

    const columnVisibility = useMemo(() => {
        const map: Record<string, boolean> = {}
        for (const col of columns) {
            const ext = col as ColumnDef<TData> & ColumnDefExtension<TData> & { accessorKey?: string }
            const key = String(ext.accessorKey ?? ext.id)
            // visible === false → siempre visible (no ocultable)
            map[key] = ext.visible === false ? true : effectiveVisible.includes(key)
        }
        return map
    }, [columns, effectiveVisible])

    // ══════════════════════════════════════════════════════════════════════════════
    // TABLA REACT (TanStack)
    // ═══════════════════════════════════════════════════════════════════════════════
    // ⭐ FIX 22 Sep 2026 — este warning es un hecho de la librería, no un defecto nuestro:
    // React Compiler no puede memoizar `useReactTable()` (devuelve funciones que no se pueden
    // memoizar sin servir UI vieja) y por eso salta este componente. Consecuencia ya documentada
    // en la Guía 0.8: el estado INTERNO de TanStack (sorting/paginación) se congela — por eso la
    // tabla gobierna ambos desde su `useState` (`internalSorting` / `internalPagination`).
    // Se silencia SOLO esta llamada; la regla sigue activa para el resto del proyecto.
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getRowId: (row) => String(rowKey(row)),
        ...(enableRowSelection
            ? {
                  enableRowSelection: true,
                  onRowSelectionChange: handleSelectionChange as never,
              }
            : {}),
        state: {
            sorting: effectiveSorting,
            ...(columnFilters !== undefined ? { columnFilters } : {}),
            columnVisibility,
            pagination: effectivePagination,
            ...(enableRowSelection ? { rowSelection: effectiveSelection } : {}),
        },
        onSortingChange: handleSortingChange,
        onColumnFiltersChange: isServerMode ? undefined : onColumnFiltersChange,
        onPaginationChange: isServerMode ? undefined : handlePaginationChange,
        onColumnVisibilityChange: (updater) => {
            const next =
                typeof updater === "function"
                    ? updater(columnVisibility as VisibilityState)
                    : updater
            const visible = Object.entries(next)
                .filter(([, v]) => v)
                .map(([k]) => k)
            handleVisibleChange(visible)
        },
        enableSorting: !isServerMode,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: isServerMode ? undefined : getPaginationRowModel(),
        manualPagination: isServerMode,
        pageCount: isServerMode ? totalPages : undefined,
        // Sort cíclico asc → desc → null (Decisión 7)
        // TanStack v8 usa sorting state: "asc" | "desc" — el null se maneja en header
    })

    // Sort cíclico asc → desc → sin orden (Decisión 7) — getToggleSortingHandler()
    // estándar de TanStack NO vuelve a null en el tercer click.
    function handleSortToggle(column: Column<TData, unknown>) {
        const current = column.getIsSorted()
        if (current === false) {
            column.toggleSorting(false) // → asc
        } else if (current === "asc") {
            column.toggleSorting(true) // → desc
        } else {
            table.setSorting([]) // → sin orden
        }
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // ESTADOS VISUALES
    // ═══════════════════════════════════════════════════════════════════════════════

    // Loading → TableSkeleton
    if (estado === "loading") {
        return (
            <TableSkeleton
                rows={pageSize}
                columns={columns.length}
                className={cn("w-full", className)}
            />
        )
    }

    // Error → bloque con Reintentar
    if (estado === "error") {
        return (
            <div className={cn("flex flex-col items-center justify-center p-8 gap-3", className)}>
                <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
                <p className="text-center text-muted-foreground">
                    No se pudieron cargar los datos
                </p>
                {onRetry && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                    >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Reintentar
                    </Button>
                )}
            </div>
        )
    }

    // Empty → mensaje + icono
    const rowCount = table.getRowModel().rows.length
    if (rowCount === 0 && estado === "idle") {
        return (
            <div className={cn("flex flex-col items-center justify-center p-8 gap-3", className)}>
                <AlertCircle className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-center text-muted-foreground">{emptyMessage}</p>
            </div>
        )
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // RENDER NORMAL
    // ═══════════════════════════════════════════════════════════════════════════════

    const headerGroups = table.getHeaderGroups()
    const rowModel = table.getRowModel()
    const isSorted = table.getState().sorting.length > 0

    // ⭐ PROMOCIÓN 20 Sep 2026 — columnas totales (colSpan de la fila expandida)
    const totalColumnas =
        (enableRowSelection ? 1 : 0) +
        (renderFilaExpandida ? 1 : 0) +
        (headerGroups[0]?.headers.length ?? 0) +
        (renderRowActions ? 1 : 0)

    // Filas seleccionadas para el toolbar (ANEXIÓN 19 Ago 2026) — resueltas contra `data`
    const selectedRows = enableRowSelection
        ? data.filter((row) => effectiveSelection[String(rowKey(row))])
        : []

    // ══════════════════════════════════════════════════════════════════════════
    // ⭐ REDISEÑO 02 Sep 2026 — clases por columna (align · movil · fija · densidad)
    // ══════════════════════════════════════════════════════════════════════════
    const extDe = (def: ColumnDef<TData>) =>
        def as ColumnDef<TData> & ColumnDefExtension<TData>

    // ⭐ MEJORA 20 Sep 2026 — alineación de los DATOS (default: centrado).
    // ⭐ FIX 20 Sep 2026 (2ª iteración): antes esto solo tocaba las columnas numéricas
    // (`align: 'derecha'`), así que el `<th>` salía centrado por el default del
    // navegador y el `<td>` de texto quedaba a la IZQUIERDA → "encabezados centrados,
    // datos a la izquierda". Ahora la alineación de la TABLA manda en los datos de
    // TODAS las columnas; el `align?` de cada columna GANA; y `align: 'derecha'`
    // además marca la columna como numérica (mono + tabular-nums).
    const claseAlineacion = (def: ColumnDef<TData>, esDato: boolean) => {
        // Alineación de la tabla (la que decide el CRUD o el default 'centro').
        const claseTabla =
            alineacionDatos === "derecha"
                ? "text-right"
                : alineacionDatos === "izquierda"
                  ? "text-left"
                  : "text-center"
        const align = extDe(def).align
        if (align === "izquierda") return "text-left"
        if (align === "centro") return "text-center"
        if (align === "derecha") {
            return esDato ? cn(claseTabla, "font-mono tabular-nums") : claseTabla
        }
        return claseTabla
    }

    // ⭐ FIX 22 Sep 2026 — el título del `<th>` vive dentro de un contenedor FLEX (etiqueta +
    // icono de sort), y en un flex manda `justify-content`, NO el `text-align` del `<th>`:
    // sin `justify-*` los encabezados quedaban PEGADOS A LA IZQUIERDA mientras los datos iban
    // centrados. Este espejo traduce la MISMA decisión de alineación que ya usa el `<th>`.
    const justifyDelHeader = (def: ColumnDef<TData>) => {
        const clase = claseAlineacion(def, false)
        if (clase.includes("text-left")) return "justify-start"
        if (clase.includes("text-right")) return "justify-end"
        return "justify-center"
    }

    const claseHeader = (header: Header<TData, unknown>) =>
        cn(
            "sticky top-0 h-11 md:h-10 px-3 align-middle",
            "font-medium text-muted-foreground",
            "border-b border-border bg-surface-2",
            claseAlineacion(header.column.columnDef, false),
            extDe(header.column.columnDef).movil === "ocultar" && "hidden md:table-cell",
            extDe(header.column.columnDef).movil === "secundaria" && "max-w-[110px] md:max-w-none",
            extDe(header.column.columnDef).fijaDerecha &&
                "sticky right-0 z-[6] shadow-[inset_1px_0_0_var(--border)]",
            extDe(header.column.columnDef).fijaIzquierda &&
                "sticky left-0 z-[6] shadow-[inset_-1px_0_0_var(--border)]",
            header.column.getCanSort() && "cursor-pointer select-none hover:bg-hover-background"
        )

    const claseCelda = (cell: Cell<TData, unknown>) =>
        cn(
            "px-3 align-middle border-b border-border bg-surface",
            densidadEfectiva === "compacto" ? "py-1.5" : "py-3",
            claseAlineacion(cell.column.columnDef, true),
            extDe(cell.column.columnDef).movil === "ocultar" && "hidden md:table-cell",
            extDe(cell.column.columnDef).movil === "secundaria" && "max-w-[110px] md:max-w-none",
            extDe(cell.column.columnDef).fijaDerecha &&
                "sticky right-0 z-[4] shadow-[inset_1px_0_0_var(--border)]",
            extDe(cell.column.columnDef).fijaIzquierda &&
                "sticky left-0 z-[4] shadow-[inset_-1px_0_0_var(--border)]",
            "group-hover:bg-hover-background",
            "group-data-[state=selected]:bg-primary-bg/50"
        )

    return (
        <div
            className={cn(
                "w-full overflow-x-auto",
                alturaMaxima && "overflow-y-auto",
                className
            )}
            style={alturaMaxima ? { maxHeight: alturaMaxima } : undefined}
        >
            {/* Barra superior: toolbar de acciones masivas (si hay selección) + ColumnSelector */}
            {(showColumnSelector && columns.length > 0) ||
            (enableRowSelection && renderToolbar && selectedRows.length > 0) ? (
                <div className="flex items-center justify-between gap-3 p-3 border-b border-border bg-surface-2">
                    {enableRowSelection && renderToolbar && selectedRows.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            {renderToolbar({
                                selected: selectedRows,
                                selectedKeys: Object.keys(effectiveSelection),
                                clearSelection: () => handleSelectionChange({}),
                            })}
                        </div>
                    )}
                    {showColumnSelector && columns.length > 0 && (
                        <div className="ml-auto">
                            <ColumnSelector
                                columns={columns as (ColumnDef<TData> & ColumnDefExtension<TData> )[]}
                                visibleColumns={effectiveVisible}
                                onVisibleColumnsChange={handleVisibleChange}
                            />
                        </div>
                    )}
                </div>
            ) : null}

            {/* ⭐ border-separate (R1/R6): sin collapse — el sticky de columnas y del
                header necesita bordes por celda, no colapsados. */}
            <table className="w-full border-separate border-spacing-0 caption-bottom text-sm" role="table">
                <thead>
                    {headerGroups.map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {renderFilaExpandida && (
                                // ⭐ FIX 22 Sep 2026 (2ª iteración) — ETIQUETA VISIBLE.
                                // Con el `<th>` vacío, la columna la dimensionaba el BOTÓN del
                                // cuerpo (44px en móvil / 32px en escritorio), así que el
                                // encabezado quedaba más angosto que las filas y los títulos no
                                // caían sobre sus datos. Con «Detalles» la columna la fija un
                                // contenido que existe en AMBOS lados y mide igual arriba y abajo.
                                <th
                                    scope="col"
                                    className="sticky top-0 z-[5] w-10 px-1 text-center align-middle font-medium text-muted-foreground bg-surface-2 border-b border-border"
                                >
                                    Detalles
                                </th>
                            )}
                            {enableRowSelection && (
                                <th
                                    className="sticky top-0 z-[5] w-12 md:w-10 px-1 text-center align-middle bg-surface-2 border-b border-border"
                                    style={{ minWidth: 44 }}
                                >
                                    {/* R3: área táctil ≥44px en <768px (Ley 5) */}
                                    <span className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center">
                                        <Checkbox
                                            checked={
                                                table.getIsSomeRowsSelected()
                                                    ? "indeterminate"
                                                    : table.getIsAllRowsSelected()
                                            }
                                            onCheckedChange={(checked) => table.toggleAllRowsSelected(!!checked)}
                                            aria-label="Seleccionar todas"
                                        />
                                    </span>
                                </th>
                            )}
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className={claseHeader(header)}
                                    style={
                                        // ⭐ FIX 22 Sep 2026 — el ancho en línea SOLO si la columna
                                        // lo declara. Antes se aplicaba SIEMPRE `header.getSize()`
                                        // (default de TanStack = 150px) como `width` Y `minWidth`:
                                        // 10 columnas = 1 500px mínimos, así que la tabla no usaba
                                        // el ancho (scroll horizontal permanente) y las clases de
                                        // `movil` (`max-w-[110px]`) eran letra muerta — el estilo en
                                        // línea gana. Sin `size` declarado, manda el contenido.
                                        header.column.columnDef.size !== undefined
                                            ? { width: header.getSize(), minWidth: header.getSize() }
                                            : undefined
                                    }
                                    onClick={
                                        header.column.getCanSort()
                                            ? () => handleSortToggle(header.column)
                                            : undefined
                                    }
                                >
                                    {header.isPlaceholder ? null : (
                                        <div
                                            className={cn(
                                                "flex items-center gap-1",
                                                justifyDelHeader(header.column.columnDef)
                                            )}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {header.column.getCanSort() && (
                                                <span
                                                    className={cn(
                                                        "flex items-center justify-center",
                                                        "transition-opacity duration-150",
                                                        // Opacidad en vez de mostrar/ocultar (Decisión 7)
                                                        isSorted
                                                            ? "opacity-100"
                                                            : "opacity-40"
                                                    )}
                                                >
                                                    {header.column.getIsSorted() === "asc" ? (
                                                        <ChevronUp className="h-3.5 w-3.5" />
                                                    ) : header.column.getIsSorted() === "desc" ? (
                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Minus className="h-3.5 w-3.5" />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </th>
                            ))}
                            {/* ⭐ COMPAT (REDISEÑO 02 Sep): renderRowActions deprecado —
                                ahora sí con <th> "Acciones" + sticky (antes no tenía header). */}
                            {renderRowActions && (
                                <th className="sticky top-0 right-0 z-[6] h-11 md:h-10 px-3 text-right align-middle font-medium text-muted-foreground bg-surface-2 border-b border-border shadow-[inset_1px_0_0_var(--border)]">
                                    Acciones
                                </th>
                            )}
                        </tr>
                    ))}
                </thead>
                <tbody className="[&_tr:last-child>td]:border-0">
                    {rowModel.rows.map((row) => {
                        const claveFila = String(rowKey(row.original))
                        const expandida = Boolean(filasExpandidas[claveFila])
                        return (
                            <Fragment key={claveFila}>
                                <tr
                                    data-state={row.getIsSelected() ? "selected" : undefined}
                                    className="group"
                                >
                                    {renderFilaExpandida && (
                                        <td className="w-10 px-1 text-center align-middle bg-surface border-b border-border">
                                            <button
                                                type="button"
                                                onClick={() => alternarExpandida(claveFila)}
                                                aria-label={expandida ? "Contraer fila" : "Expandir fila"}
                                                aria-expanded={expandida}
                                                className="mx-auto flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded hover:bg-hover-background"
                                            >
                                                {expandida ? (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </button>
                                        </td>
                                    )}
                                    {enableRowSelection && (
                                        <td className="w-12 md:w-10 px-1 text-center align-middle bg-surface border-b border-border" style={{ minWidth: 44 }}>
                                            <span className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center">
                                                <Checkbox
                                                    checked={row.getIsSelected()}
                                                    onCheckedChange={(checked) => row.toggleSelected(!!checked)}
                                                    aria-label="Seleccionar fila"
                                                />
                                            </span>
                                        </td>
                                    )}
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className={claseCelda(cell)}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                    {renderRowActions && (
                                        <td className="sticky right-0 z-[4] px-2 py-1.5 md:py-2 text-right align-middle bg-surface border-b border-border shadow-[inset_1px_0_0_var(--border)] group-hover:bg-hover-background group-data-[state=selected]:bg-primary-bg/50">
                                            {renderRowActions(row.original)}
                                        </td>
                                    )}
                                </tr>
                                {renderFilaExpandida && expandida && (
                                    <tr>
                                        <td
                                            colSpan={totalColumnas}
                                            className="border-b border-border bg-surface-2 px-3 py-3"
                                        >
                                            {renderFilaExpandida(row.original)}
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        )
                    })}
                </tbody>
            </table>

            {/* Pagination inferior */}
            <Pagination
                page={isServerMode ? page! : table.getState().pagination.pageIndex + 1}
                pageSize={pageSize}
                totalPages={isServerMode ? totalPages! : table.getPageCount()}
                onPageChange={isServerMode ? onPageChange! : (p) => table.setPageIndex(p - 1)}
                onPageSizeChange={onPageSizeChange ?? ((ps) => table.setPageSize(ps))}
                pageSizeOptions={pageSizeOptions}
            />
        </div>
    )
}
