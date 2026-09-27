'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ALTA EN ALMACÉN — aterrizaje del submódulo (Guía 1.6 · Fase 4)
//
// Pasa a ser el HUB del PUESTO (fichas de acceso), no la cola: la cola de cotejo vive en la
// ruta hija `/dashboard/entradas/alta/cotejo`. Motivo: el almacenista necesita los tres
// destinos de su puesto (cotejar · catálogo SKU · movimientos/kardex) y la cola es solo uno
// de ellos — es el patrón del HUB de la V5 (`DISENO_ALMACEN_SKU.md §6`).
//
// El href del submódulo NO cambió: el sidebar, el RBAC (`useCanAction('/dashboard/entradas/alta')`)
// y el toolbar siguen apuntando al mismo lugar. La ruta hija queda cubierta por prefijo.
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'

import { AlmacenHub } from '@/components/entradas/AlmacenHub'

export default function Page() {
    return (
        <Suspense fallback={null}>
            <AlmacenHub />
        </Suspense>
    )
}
