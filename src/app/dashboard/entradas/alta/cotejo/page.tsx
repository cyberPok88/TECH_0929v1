'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COTEJO Y ALTA — ruta hija del HUB de Almacén (Guía 1.6 · Fase 4)
//
// La cola de cotejo (tandas entregadas + saldo clásico) vivía en `/dashboard/entradas/alta`;
// con el HUB (fichas) la cola baja a esta ruta. El submódulo `alta` la cubre por prefijo, así
// que no cambian ni el sidebar ni el RBAC: `AltaCatalogo` sigue validando
// `useCanAction('/dashboard/entradas/alta', …)` y declarando ese mismo `path` al shell.
//
// Retroceso visible (L13): «← Atrás» vuelve al HUB; no se depende del botón del navegador.
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AltaCatalogo } from '@/components/entradas/AltaCatalogo'

export default function Page() {
    return (
        <div className="space-y-3">
            <Link
                href="/dashboard/entradas/alta"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-hover-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc-entradas"
            >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Atrás
            </Link>
            <Suspense fallback={null}>
                <AltaCatalogo />
            </Suspense>
        </div>
    )
}
