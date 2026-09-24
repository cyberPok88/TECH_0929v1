'use client'

import { Suspense } from 'react'

import { InventarioFisicoCatalogo } from '@/components/inventario/InventarioFisicoCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <InventarioFisicoCatalogo />
        </Suspense>
    )
}
