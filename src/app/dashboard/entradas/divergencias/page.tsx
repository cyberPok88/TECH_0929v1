'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DIVERGENCIAS — página del submódulo (Guía 1.6 · delgada)
// Solo monta <DivergenciasCatalogo/> dentro de Suspense (patrón 1.1–1.5).
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { DivergenciasCatalogo } from '@/components/entradas/DivergenciasCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <DivergenciasCatalogo />
        </Suspense>
    )
}
