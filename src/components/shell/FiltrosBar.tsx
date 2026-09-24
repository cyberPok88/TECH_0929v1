// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN DE FILTROS DEL SHELL — Guía 0.6 · decisión 25 (01 Sep 2026)
//
// El ESPACIO donde cada página registra sus controles de filtro. Igual que la
// Toolbar recibe las acciones (usePageConfig.actions), esta sección recibe los
// filtros (usePageConfig.filtros). Colapsa si la página no registra nada.
// ═══════════════════════════════════════════════════════════════════════════════
'use client'

import { usePageContextStore } from '@/lib/stores/page-context-store'

export function FiltrosBar() {
    const filtros = usePageContextStore((s) => s.filtros)

    // Sin filtros registrados → la sección no existe (colapsa).
    if (filtros == null) return null

    return (
        <div className="flex flex-col gap-2 border-b border-border bg-surface px-3 py-2 md:flex-row md:flex-wrap md:items-center">
            {filtros}
        </div>
    )
}
