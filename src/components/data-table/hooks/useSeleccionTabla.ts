"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// USE SELECCION TABLA — Guía 0.8 · ⭐ NACE 02 Sep 2026 (Decisión 21)
// Estado de selección UNIFORME para los CRUDs: mata la divergencia de formas
// (selectedKeys · seleccion · selectedIds.reduce) y el boilerplate Object.keys().
// El CRUD pasa { seleccion, onSeleccionChange } al DataTable (modo controlado).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from "react"
import type { SeleccionTabla } from "@/types/table"

export function useSeleccionTabla<TData = unknown>(
    filas: TData[],
    rowKey: (row: TData) => string | number
): SeleccionTabla<TData> {
    const [seleccion, setSeleccion] = useState<Record<string, boolean>>({})

    const onSeleccionChange = useCallback((next: Record<string, boolean>) => {
        setSeleccion(next)
    }, [])

    const claves = useMemo(() => Object.keys(seleccion), [seleccion])

    const seleccionados = useMemo(
        () => filas.filter((fila) => seleccion[String(rowKey(fila))]),
        [filas, seleccion, rowKey]
    )

    const alternar = useCallback(
        (fila: TData) => {
            const clave = String(rowKey(fila))
            setSeleccion((prev) => {
                const next = { ...prev }
                if (next[clave]) delete next[clave]
                else next[clave] = true
                return next
            })
        },
        [rowKey]
    )

    const limpiar = useCallback(() => setSeleccion({}), [])

    return { seleccion, onSeleccionChange, claves, seleccionados, alternar, limpiar }
}
