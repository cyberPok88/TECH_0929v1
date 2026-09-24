'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ATRIBUTOS CHIPS — píldoras de características (Guía 1.2 · Parte 2 · Dumb)
// Muestra los atributos destacados del producto con un orden preferido
// (capacidad · tipo · tamaño · interfaz · bus) y completa con el resto (≤ 3).
// ═══════════════════════════════════════════════════════════════════════════════

import type { AtributosProducto } from '@/types/productos'

const ORDEN_PREFERIDO = ['capacidad', 'tipo', 'tamano', 'interface', 'bus']

interface AtributosChipsProps {
    atributos: AtributosProducto
    max?: number
}

export function AtributosChips({ atributos, max = 3 }: AtributosChipsProps) {
    const entradas = Object.entries(atributos).filter(
        ([, v]) => v !== null && v !== '' && v !== undefined
    ) as [string, string | number | boolean][]

    if (entradas.length === 0) {
        return <span className="text-muted-foreground">—</span>
    }

    entradas.sort((a, b) => {
        const ia = ORDEN_PREFERIDO.indexOf(a[0])
        const ib = ORDEN_PREFERIDO.indexOf(b[0])
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

    const visibles = entradas.slice(0, max)

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visibles.map(([clave, valor]) => (
                <span
                    key={clave}
                    className="inline-flex items-center rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
                    title={clave}
                >
                    {String(valor)}
                </span>
            ))}
            {entradas.length > max && (
                <span className="text-[11px] text-muted-foreground">
                    +{entradas.length - max}
                </span>
            )}
        </div>
    )
}
