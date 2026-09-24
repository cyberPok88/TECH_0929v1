'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ALTA EN ALMACÉN — página del submódulo (Guía 1.6 · delgada)
// Solo monta <AltaCatalogo/> dentro de Suspense (patrón 1.1–1.5).
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { AltaCatalogo } from '@/components/entradas/AltaCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <AltaCatalogo />
        </Suspense>
    )
}
