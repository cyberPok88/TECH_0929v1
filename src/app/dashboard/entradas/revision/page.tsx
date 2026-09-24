'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// REVISIÓN — página del submódulo (Guía 1.6 · delgada)
// Solo monta <RevisionCatalogo/> dentro de Suspense (patrón 1.1–1.5).
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { RevisionCatalogo } from '@/components/entradas/RevisionCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <RevisionCatalogo />
        </Suspense>
    )
}
