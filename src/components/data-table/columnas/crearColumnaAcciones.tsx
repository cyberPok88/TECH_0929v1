"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// CREAR COLUMNA DE ACCIONES — Guía 0.8 · ⭐ PROMOCIÓN 02 Sep 2026 (Decisión 20)
// Factory genérica de la columna de acciones por fila: encabezado "Acciones",
// sticky derecha, no ocultable.
// ⭐ MEJORA 20 Sep 2026 (usuario): TODAS las acciones se muestran INLINE — ya no
// hay dropdown ⋮ que oculte las secundarias. El CRUD declara `acciones` y
// `secundarias`; la columna las pinta juntas (mismo orden declarado).
// La 0.8 renderiza; el RBAC lo envuelve el CRUD (ProtectedAction/useCanAction — 0.7).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import type { ColumnDefExtension, RowAction } from "@/types/table"

interface CrearColumnaAccionesProps<TData = unknown> {
    /** Acciones primarias — iconos inline (Eye, Pencil, Archive…).
     *  El CRUD envuelve cada onClick con ProtectedAction/useCanAction (0.7). */
    acciones: RowAction<TData>[]
    /** Acciones secundarias — ⭐ 20 Sep: también INLINE (antes iban al dropdown ⋮). */
    secundarias?: RowAction<TData>[]
    /** Etiqueta del encabezado (default: "Acciones") */
    label?: string
}

export function crearColumnaAcciones<TData = unknown>({
    acciones,
    secundarias,
    label = "Acciones",
}: CrearColumnaAccionesProps<TData>): ColumnDef<TData> & ColumnDefExtension<TData> {
    return {
        id: "acciones",
        header: label,
        // Contrato: nunca ocultable · centrada · sticky derecha (R1)
        visible: false,
        align: "centro",
        fijaDerecha: true,
        cell: ({ row }) => {
            // ⭐ ANEXIÓN 02 Sep 2026 — disabled puede ser predicado por fila
            // (patrón "no te operes a ti mismo" de la Guía 0.9).
            const deshabilitada = (accion: RowAction<TData>): boolean =>
                typeof accion.disabled === "function"
                    ? accion.disabled(row.original)
                    : accion.disabled ?? false

            const todas: RowAction<TData>[] = [...acciones, ...(secundarias ?? [])]

            return (
                <div className="flex items-center justify-center gap-0.5">
                    {todas.map((accion) => (
                        <Button
                            key={accion.label}
                            variant={accion.variant ?? "ghost"}
                            size="icon"
                            onClick={() => accion.onClick(row.original)}
                            disabled={deshabilitada(accion)}
                            title={accion.label}
                            aria-label={accion.label}
                            data-accion={accion.dataAccion}
                            // R3: objetivo táctil ≥44px en <768px (Ley 5), denso en escritorio
                            className="h-11 w-11 md:h-8 md:w-8"
                        >
                            <accion.icon className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    ))}
                </div>
            )
        },
    }
}
