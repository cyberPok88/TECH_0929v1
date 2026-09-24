'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ACONDICIONAMIENTO — página del submódulo (Guía 1.6 · delgada)
// Solo monta <AcondicionamientoCatalogo/> dentro de Suspense (patrón 1.1–1.5).
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { AcondicionamientoCatalogo } from '@/components/entradas/AcondicionamientoCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <AcondicionamientoCatalogo />
        </Suspense>
    )
}
