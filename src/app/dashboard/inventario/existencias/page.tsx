'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTENCIAS — página del submódulo (Guía 1.5 · delgada)
// Solo monta <ExistenciasCatalogo/> dentro de Suspense (patrón 1.1–1.4).
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { ExistenciasCatalogo } from '@/components/inventario/ExistenciasCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ExistenciasCatalogo />
        </Suspense>
    )
}
