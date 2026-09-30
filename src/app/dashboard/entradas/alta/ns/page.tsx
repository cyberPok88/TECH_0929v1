'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL DE NS — ruta hija del HUB de Almacén (Guía 1.6 · 29 Sep 2026)
//
// La 4ª ficha del puesto. Igual que `cotejo`, el submódulo `alta` la cubre por prefijo, así que no
// cambian ni el sidebar ni el RBAC: la consulta valida y declara `/dashboard/entradas/alta`.
//
// Retroceso visible (L13): «← Atrás» vuelve al HUB; no se depende del botón del navegador.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { ControlNsCatalogo } from '@/components/entradas/alta/ControlNsCatalogo'

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
            <ControlNsCatalogo />
        </div>
    )
}
