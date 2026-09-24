"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE SKELETON — Loading state con animate-pulse (CONVENCIONES §7)
// Guía 0.8 — Cero JS, puro CSS. Imita forma real de la tabla.
// Props: rows (default 5), columns (número de celdas por fila)
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from "@/lib/utils"

interface TableSkeletonProps {
    /** Número de filas skeleton a mostrar (default: 5) */
    rows?: number
    /** Número de columnas (celdas por fila). Si no se pasa, infiere 6. */
    columns?: number
    /** className adicional */
    className?: string
}

export function TableSkeleton({
    rows = 5,
    columns = 6,
    className,
}: TableSkeletonProps) {
    return (
        <div className={cn("overflow-x-auto", className)}>
            <table className="w-full caption-bottom text-sm" role="table">
                <thead className="[&_tr]:border-b border-border">
                    <tr className="border-b border-border">
                        {Array.from({ length: columns }).map((_, colIdx) => (
                            <th
                                key={`col-${colIdx}`}
                                className={cn(
                                    "h-12 px-3 text-left align-middle",
                                    "font-medium text-muted-foreground",
                                    "[&:has([role=checkbox])]:pr-0",
                                    "dark:bg-surface-2"
                                )}
                            >
                                <div
                                    // ⭐ FIX 22 Sep 2026 — `mx-auto`: las barras fantasma son
                                    // bloques con ancho, así que `text-left` del `<th>` no las
                                    // movía y el estado de CARGA salía alineado a la izquierda
                                    // mientras la tabla cargada va centrada (`alineacionDatos`).
                                    className="mx-auto h-4 w-3/4 bg-muted animate-pulse rounded"
                                    style={{ animationDelay: `${colIdx * 30}ms` }}
                                    aria-hidden="true"
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <tr
                            key={`row-${rowIdx}`}
                            className={cn(
                                "border-b border-border",
                                "transition-colors hover:bg-hover-background",
                                "data-[state=selected]:bg-primary-bg/50"
                            )}
                            style={{ animationDelay: `${rowIdx * 50}ms` }}
                        >
                            {Array.from({ length: columns }).map((_, colIdx) => (
                                <td
                                    key={`cell-${rowIdx}-${colIdx}`}
                                    className={cn(
                                        "p-3 align-middle",
                                        "[&:has([role=checkbox])]:pr-0",
                                        "first:pl-4 last:pr-4"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            // Mismo criterio que el `<th>` de arriba: la barra es un
                                            // bloque con ancho → se centra con `mx-auto`.
                                            "mx-auto h-4 bg-muted animate-pulse rounded",
                                            colIdx === 0 && "w-1/3",
                                            colIdx > 0 && colIdx < columns - 1 && "w-1/2",
                                            colIdx === columns - 1 && "w-1/4"
                                        )}
                                        aria-hidden="true"
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
