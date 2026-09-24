// ═══════════════════════════════════════════════════════════════════════════════
// SELLO FISCAL — Píldora ámbar que marca datos obligatorios (Guía 0.8 · Parte 7)
//
// PROMOCIÓN 23 Ago 2026 desde catalogos/proveedor-form/SelloFiscal.tsx.
// Al llegar el 2º consumidor (Productos 1.1 para sus 2 campos SAT) subió a
// la 0.8 sin cambio de firma.
//
// Componente dumb (sin lógica ni estado). Tokens `warning`/`warning-bg` del
// CATALOGO_UI. Con `conIcono` antepone un glifo "F" (píldoras de obligatorios
// tipo Decisión 0 del rediseño de proveedor); sin ícono es la etiqueta FISCAL
// (o el texto que el consumidor pase por children) que acompaña a los labels
// de los campos obligatorios de cada dominio.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'

interface SelloFiscalProps {
    /** Antepone el glifo "F" (píldoras de obligatorios de la Decisión 0). */
    conIcono?: boolean
    /** Texto de la píldora. Default: 'FISCAL'. */
    children?: ReactNode
}

export function SelloFiscal({ conIcono = false, children = 'FISCAL' }: SelloFiscalProps) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/45 bg-warning-bg px-2 py-px font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-warning">
            {conIcono && <span aria-hidden="true">F</span>}
            {children}
        </span>
    )
}
