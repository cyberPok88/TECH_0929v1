"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMN SELECTOR — Checkboxes para mostrar/ocultar columnas
// Guía 0.8 — DropdownMenu + Checkbox (shadcn, Parte 1)
// Persiste en localStorage bajo "erp-table-columns-{ruta}" (Decisión 8)
// Primera vez: TODAS visibles. Columnas con extension visible=false: filtradas.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Columns3 } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import type { ColumnDefExtension } from "@/types/table"

interface ColumnSelectorProps<TData> {
    /** Columnas con extensión visible/render */
    columns: (ColumnDef<TData> & ColumnDefExtension<TData>)[]
    /** Columnas visibles actuales (controlado) — si no, interno + localStorage */
    visibleColumns?: string[]
    /** Callback cambio de visibilidad (controlado) */
    onVisibleColumnsChange?: (columns: string[]) => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE PERSISTENCIA (localStorage — Decisión 8)
// No es dato de negocio: es preferencia visual del usuario en su dispositivo.
// ═══════════════════════════════════════════════════════════════════════════════

function getStorageKey(): string {
    // Ruta actual → clave única por pantalla: erp-table-columns-/dashboard/ventas
    return `erp-table-columns-${window.location.pathname}`
}

function loadPersisted(path: string): string[] | null {
    try {
        const raw = window.localStorage.getItem(path)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return null
        return parsed as string[]
    } catch {
        // JSON corrupto → ignorar silenciosamente
        return null
    }
}

export function ColumnSelector<TData>({
    columns,
    visibleColumns,
    onVisibleColumnsChange,
}: ColumnSelectorProps<TData>) {
    // Determina si el padre controla (paso de props) → no tocar localStorage
    const isControlled = visibleColumns !== undefined && onVisibleColumnsChange !== undefined

    // Identificador de columna (accessorKey de ColumnDefDataAccessor ?? id de ColumnDefBase).
    // Cast estructural SIN any (no-explicit-any es error en el repo) — accessorKey no existe
    // en TODAS las variantes de la union ColumnDef<TData>.
    const getColumnKey = (col: ColumnDef<TData> & ColumnDefExtension<TData>) =>
        (col as ColumnDef<TData> & ColumnDefExtension<TData> & { accessorKey?: string }).accessorKey ?? col.id

    // Columnas candidatas al selector (excluye visible:false de la extensión)
    const selectableColumns = columns.filter((col) => {
        const ext = col as ColumnDef<TData> & ColumnDefExtension<TData>
        return ext.visible !== false && getColumnKey(col)
    })

    // Inicialización perezosa UNA sola vez (no controlado): estado interno ← persistencia.
    // NO usar useEffect + setState (react-hooks/set-state-in-effect es error — precedente RBACGuard 0.7).
    const storageKey = getStorageKey()
    const [internalVisible, setInternalVisible] = useState<string[] | null>(() => {
        if (isControlled) return null

        const persisted = loadPersisted(storageKey)
        if (persisted && persisted.length > 0) {
            // Solo conserva columnas que existen en la pantalla actual
            const valid = persisted.filter((key) =>
                selectableColumns.some((c) => String(getColumnKey(c)) === key)
            )
            if (valid.length > 0) {
                return valid
            }
        }

        // Primera vez: TODAS visibles
        return selectableColumns.map((c) => String(getColumnKey(c)))
    })

    // ══════════════════════════════════════════════════════════════════════════════
    // VISIBILIDAD EFECTIVA (controlado > interno > todas)
    // ═══════════════════════════════════════════════════════════════════════════════

    const effectiveVisible = isControlled
        ? visibleColumns
        : internalVisible ?? selectableColumns.map((c) => String(getColumnKey(c)))

    // ══════════════════════════════════════════════════════════════════════════════
    // HANDLER DE TOOGLE
    // ═══════════════════════════════════════════════════════════════════════════════

    function handleToggle(key: string) {
        const next = effectiveVisible.includes(key)
            ? effectiveVisible.filter((k) => k !== key)
            : [...effectiveVisible, key]

        if (isControlled) {
            onVisibleColumnsChange(next)
        } else {
            setInternalVisible(next)
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(next))
            } catch {
                // Quota o privacidad → simplemente no persiste
            }
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Columns3 className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Columnas</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-56 bg-surface-raised border-border shadow-premium-md"
            >
                {selectableColumns.map((col) => {
                    const key = String(getColumnKey(col))
                    const isChecked = effectiveVisible.includes(key)

                    return (
                        <DropdownMenuCheckboxItem
                            key={key}
                            checked={isChecked}
                            // Radix cierra el menú al seleccionar por defecto. preventDefault
                            // lo mantiene abierto: el usuario puede quitar/marcar VARIAS
                            // columnas sin reabrir (FIX 19 Ago 2026). Cierra con click
                            // afuera o Escape (comportamiento estándar de DropdownMenu).
                            onSelect={(event) => event.preventDefault()}
                            onCheckedChange={() => handleToggle(key)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        >
                            <span className="truncate">{String(col.header ?? key)}</span>
                        </DropdownMenuCheckboxItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
