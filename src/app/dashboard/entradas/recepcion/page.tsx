'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RECEPCIÓN — página del submódulo (Guía 1.6 · delgada)
// Solo monta <RecepcionCatalogo/> dentro de Suspense (patrón 1.1–1.5).
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { RecepcionCatalogo } from '@/components/entradas/RecepcionCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <RecepcionCatalogo />
        </Suspense>
    )
}
