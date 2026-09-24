'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTOS — página del CRUD (Guía 1.2 · Parte 2)
// Reemplaza el placeholder de la 0.6. Página DELGADA (Regla 1 de estructura-crud):
// solo monta <ProductosCatalogo/> — sin lógica de negocio inline.
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { ProductosCatalogo } from '@/components/catalogos/productos/ProductosCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ProductosCatalogo />
        </Suspense>
    )
}
