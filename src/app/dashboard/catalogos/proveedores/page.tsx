'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDORES — página del CRUD (Guía 1.1 · Parte 2)
// Reemplaza el placeholder de la 0.6. Página DELGADA (Regla 1 de estructura-crud):
// solo monta <ProveedoresCatalogo/>. El orquestador Smart registra usePageConfig
// y sus acciones de Toolbar (patrón 0.9/0.10) — aquí no hay lógica de negocio.
// Suspense: el deep link ?proveedor={id} vive en el Catalogo vía useSearchParams.
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { ProveedoresCatalogo } from '@/components/catalogos/proveedores/ProveedoresCatalogo'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ProveedoresCatalogo />
        </Suspense>
    )
}
