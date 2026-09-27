'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SPINNER — el estado «cargando» del kit (Guía 0.8 · presentacional)
//
// ⭐ 24 Sep 2026 (usuario): *«quiero un loader cada que algo está cargando»*.
// Es presentacional puro: no conoce negocio, solo dice «esto está trabajando». Dos usos:
//   · **con `etiqueta`** → bloque que está cargando («Cargando partidas…»);
//   · **sin `etiqueta`** → dentro de un botón, junto a su texto («Guardando…»).
// El `role="status"` + `aria-live` hacen que un lector de pantalla también se entere; cuando no
// hay etiqueta visible queda un `sr-only` para no dejar el aviso mudo.
// ⚠️ La tabla NO usa esto: su estado de carga es el `TableSkeleton` del kit (esqueleto con la
// forma de la tabla), que es mejor señal que un giro suelto.
// ═══════════════════════════════════════════════════════════════════════════════

import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SpinnerProps {
    /** Texto al lado del giro. Sin él queda solo el giro (y el aviso para lectores). */
    etiqueta?: string
    className?: string
}

export function Spinner({ etiqueta, className }: SpinnerProps) {
    return (
        <span
            role="status"
            aria-live="polite"
            className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
        >
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {etiqueta ? (
                <span className="text-sm">{etiqueta}</span>
            ) : (
                <span className="sr-only">Cargando…</span>
            )}
        </span>
    )
}
