"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION — Controles de paginación (local o servidor)
// Guía 0.8 — Desacoplado del modo: recibe page/pageSize/totalPages + callbacks
// Selector de pageSize con <select> nativo (tokens) — sin dependencia Select shadcn
// ═══════════════════════════════════════════════════════════════════════════════

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { PageSizeOption } from "@/types/table"

interface PaginationProps {
    /** Página actual (base 1) */
    page: number
    /** Filas por página actual */
    pageSize: number
    /** Total de páginas */
    totalPages: number
    /** Callback cambio de página (page base 1) */
    onPageChange: (page: number) => void
    /** Callback cambio de pageSize */
    onPageSizeChange: (pageSize: number) => void
    /** Opciones del selector (default: [10, 20, 50, 100]) */
    pageSizeOptions?: PageSizeOption[]
    /** className adicional */
    className?: string
}

const DEFAULT_PAGE_SIZE_OPTIONS: PageSizeOption[] = [
    { value: 10, label: "10" },
    { value: 20, label: "20" },
    { value: 50, label: "50" },
    { value: 100, label: "100" },
]

/**
 * Genera array de números de página a mostrar con truncado elíptico.
 * Siempre incluye: 1, totalPages, y vecinos ±2 de la página actual.
 * Inserta "..." (elipsis) donde hay saltos.
 */
function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | "...")[] = [1]
    const start = Math.max(2, page - 2)
    const end = Math.min(totalPages - 1, page + 2)

    if (start > 2) pages.push("...")

    for (let i = start; i <= end; i++) {
        pages.push(i)
    }

    if (end < totalPages - 1) pages.push("...")

    pages.push(totalPages)
    return pages
}

export function Pagination({
    page,
    pageSize,
    totalPages,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    className,
}: PaginationProps) {
    if (totalPages <= 1) return null

    const pageNumbers = getPageNumbers(page, totalPages)

    return (
        <div
            className={cn(
                "flex flex-col sm:flex-row items-center justify-between gap-3",
                "px-4 py-3 border-t border-border bg-surface-2",
                className
            )}
            role="navigation"
            aria-label="Paginación"
        >
            {/* Selector de filas por página */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <label htmlFor="page-size" className="sr-only">
                    Filas por página
                </label>
                <select
                    id="page-size"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className={cn(
                        "h-8 px-2 py-1 text-sm",
                        "bg-surface border border-border",
                        "focus:outline-none focus:ring-2 focus:ring-primary",
                        "cursor-pointer"
                    )}
                    aria-label="Filas por página"
                >
                    {pageSizeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Controles de navegación */}
            <div className="flex items-center gap-1">
                {/* Primera página */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPageChange(1)}
                    disabled={page === 1}
                    aria-label="Primera página"
                    title="Primera página"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Anterior */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    aria-label="Página anterior"
                    title="Anterior"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Números de página — ⭐ R5 (REDISEÑO 02 Sep): ocultos en <640px,
                    queda «‹ › + info»; el foco móvil es la página actual, no el salto */}
                <div className="hidden sm:flex items-center gap-1" role="group" aria-label="Páginas">
                    {pageNumbers.map((item, idx) =>
                        item === "..." ? (
                            <span
                                key={`ellipsis-${idx}`}
                                className="px-2 text-muted-foreground"
                                aria-hidden="true"
                            >
                                …
                            </span>
                        ) : (
                            <Button
                                key={item}
                                variant={item === page ? "default" : "ghost"}
                                size="sm"
                                onClick={() => onPageChange(item)}
                                disabled={item === page}
                                aria-label={`Página ${item}`}
                                aria-current={item === page ? "page" : undefined}
                            >
                                {item}
                            </Button>
                        )
                    )}
                </div>

                {/* Siguiente */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    aria-label="Página siguiente"
                    title="Siguiente"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Última página */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPageChange(totalPages)}
                    disabled={page === totalPages}
                    aria-label="Última página"
                    title="Última página"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Info de página actual */}
            <div className="text-xs text-muted-foreground self-center sm:self-start">
                Página {page} de {totalPages}
            </div>
        </div>
    )
}
