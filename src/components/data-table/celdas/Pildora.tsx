'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PILDORA — Guía 0.8 Parte 5 · Dumb Component
//
// Insignia de estado genérica para los CRUDs. Recibe el TEXTO y el TONO ya
// resueltos: no conoce ningún vocabulario de negocio.
//
// Esa frontera es la razón de que exista. Cada dominio nombra sus estados
// distinto —activo/inactivo, pagada/vencida, disponible/agotado— pero todos
// necesitan la misma caja. Si el componente conociera los estados, cada CRUD
// nuevo tendría que editarlo; conociendo solo el tono, ninguno lo toca.
//
// El mapa estado → tono vive en cada CRUD, junto al resto de su vocabulario.
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

/** Intención semántica, no color. `success` es verde en las 3 paletas, pero
 *  quien la usa declara "esto salió bien", no "esto es verde".
 *  ⭐ MEJORA 22 Sep 2026 — la familia completa para los **10 estados del flujo**:
 *  5 tonos de TINTA (translúcido) + 5 de RELLENO (`-bg` opaco). La FORMA dice el momento:
 *  en cola ↔ en marcha · terminó ↔ cerrado · pendiente ↔ bloqueado. Antes había 5 tonos
 *  para 10 estados, así que estados distintos salían del MISMO color (el caso reportado:
 *  «recién creada» y «ajustada» idénticos). */
export type TonoPildora =
    | 'exito'
    | 'advertencia'
    | 'info'
    | 'peligro'
    | 'neutro'
    | 'listo'
    | 'hito'
    | 'encurso'
    | 'avanzando'
    | 'bloqueado'

const TONO_CAJA: Record<TonoPildora, string> = {
    // Remasterización: el estado positivo/activo es el "principal" → forma
    // SÓLIDA (tinte opaco `-bg`); el resto conserva la tinta translúcida.
    exito: 'border-transparent bg-success-bg text-success',
    advertencia: 'border-warning/30 bg-warning/10 text-warning',
    info: 'border-info/30 bg-info/10 text-info',
    peligro: 'border-destructive/30 bg-destructive/10 text-destructive',
    neutro: 'border-border bg-surface-2 text-muted-foreground',
    // ── Los 5 tonos nuevos (mismos tokens; la FORMA dice el momento) ────────────
    listo: 'border-success/30 bg-success/10 text-success', // éxito en tinta
    encurso: 'border-transparent bg-info-bg text-info', // info en relleno
    avanzando: 'border-transparent bg-warning-bg text-warning', // advertencia en relleno
    bloqueado: 'border-transparent bg-destructive-bg text-destructive', // peligro en relleno
    // ⚠️ `hito` usa el token de la 4ª serie de gráficos (hue 320/340/340 en las 3 paletas):
    // es la ÚNICA familia que no choca con los semánticos. `primary` y `secondary` NO sirven
    // como color de estado porque cambian de hue por paleta (en Obsidiana `primary` es ámbar
    // ≈ `warning`; en Piedra `secondary` es verde = `success`). Mismo origen que usó la
    // remasterización para los acentos de módulo (SPEC_TOKENS_ACENTOS §1).
    hito: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
}

/** El punto no es otro lenguaje: es la misma señal sin la caja. */
const TONO_PUNTO: Record<TonoPildora, string> = {
    exito: 'bg-success',
    advertencia: 'bg-warning',
    info: 'bg-info',
    peligro: 'bg-destructive',
    neutro: 'bg-muted-foreground',
    listo: 'bg-success',
    hito: 'bg-chart-4',
    encurso: 'bg-info',
    avanzando: 'bg-warning',
    bloqueado: 'bg-destructive',
}

interface PildoraProps {
    /** Ya traducido al idioma del usuario. La Pildora no traduce. */
    texto: string
    tono?: TonoPildora
    /** 'punto' donde el ancho es escaso · 'corta' en tablas · 'larga' en encabezados */
    variante?: 'punto' | 'corta' | 'larga'
    className?: string
}

export function Pildora({
    texto,
    tono = 'neutro',
    variante = 'corta',
    className,
}: PildoraProps) {
    // Variante punto: 6px que dicen lo mismo. El texto no se pierde — sigue en
    // title y en aria-label, que es donde importa que esté.
    if (variante === 'punto') {
        return (
            <span
                title={texto}
                aria-label={texto}
                role="img"
                className={cn('size-1.5 shrink-0 rounded-full', TONO_PUNTO[tono], className)}
            />
        )
    }

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center rounded-full border font-medium',
                'px-2 py-0.5 text-[10px] uppercase tracking-wide',
                variante === 'larga' && 'px-2.5 py-1 text-xs',
                TONO_CAJA[tono],
                className
            )}
        >
            {texto}
        </span>
    )
}
