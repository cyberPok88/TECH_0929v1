'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// FICHA DE ACCESO — la tarjeta de un panel de módulo (Guía 2.4 · 05 Oct 2026)
//
// ⭐ PROMOCIÓN A LA 0.8 (gate de componente-ui, Fase 5). El patrón estaba COPIADO
//   LITERAL en 2 archivos — `EntradasDashboard.tsx` y `AlmacenHub.tsx`, misma firma
//   `text-[68px]` + `min-h-[150px]` (medido con grep el 05 Oct 2026) — y Configuración
//   habría sido la tercera. La promoción **RETIRA las copias**, no solo evita la nueva.
//
// ⭐ EL ACENTO ES UNA PROP OBLIGATORIA. Las 2 copias lo tenían HARDCODEADO en
//   `acc-entradas`; la pantalla de Configuración usa `acc-sistema` (CATALOGO_UI L56).
//   🔴 Y es una UNIÓN + MAPA ESTÁTICO, nunca `text-${acento}`: Tailwind compila las
//   clases que VE ESCRITAS — con un string dinámico la clase no se genera, el navegador
//   descarta la declaración EN SILENCIO y el color desaparece sin que tsc/lint/build
//   digan nada (es la Ley 4 del kit, el único defecto que ninguna herramienta ve).
//
// ⚠️ Es DUMB: no lee stores, no resuelve iconos del menú, no decide el destino.
//    Recibe `icono` como COMPONENTE e `href` ya armado.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Los módulos con token de acento propio (CATALOGO_UI §1). */
export type AcentoFicha = 'entradas' | 'sistema' | 'catalogos' | 'compras' | 'inventario'

/**
 * 🔴 Mapa ESTÁTICO: las clases están escritas una por una para que Tailwind las vea.
 *    NO convertir a plantilla de string — ver la nota de arriba.
 */
const ACENTO: Record<AcentoFicha, { hover: string; anillo: string; fantasma: string; caja: string }> = {
    entradas: {
        hover: 'hover:border-acc-entradas hover:bg-acc-entradas',
        anillo: 'focus-visible:ring-acc-entradas',
        fantasma: 'text-acc-entradas/15',
        caja: 'border-acc-entradas/30 bg-acc-entradas/10 text-acc-entradas',
    },
    sistema: {
        hover: 'hover:border-acc-sistema hover:bg-acc-sistema',
        anillo: 'focus-visible:ring-acc-sistema',
        fantasma: 'text-acc-sistema/15',
        caja: 'border-acc-sistema/30 bg-acc-sistema/10 text-acc-sistema',
    },
    catalogos: {
        hover: 'hover:border-acc-catalogos hover:bg-acc-catalogos',
        anillo: 'focus-visible:ring-acc-catalogos',
        fantasma: 'text-acc-catalogos/15',
        caja: 'border-acc-catalogos/30 bg-acc-catalogos/10 text-acc-catalogos',
    },
    compras: {
        hover: 'hover:border-acc-compras hover:bg-acc-compras',
        anillo: 'focus-visible:ring-acc-compras',
        fantasma: 'text-acc-compras/15',
        caja: 'border-acc-compras/30 bg-acc-compras/10 text-acc-compras',
    },
    inventario: {
        hover: 'hover:border-acc-inventario hover:bg-acc-inventario',
        anillo: 'focus-visible:ring-acc-inventario',
        fantasma: 'text-acc-inventario/15',
        caja: 'border-acc-inventario/30 bg-acc-inventario/10 text-acc-inventario',
    },
}

interface FichaAccesoProps {
    /** El destino, ya armado por el panel. */
    href: string
    /** El número fantasma, **ya formateado** (`'01'`) — la ficha no impone formato. */
    numero: string
    /** El icono resuelto por el panel (`getIcon(...)` o el import directo). */
    icono: LucideIcon
    /** El nombre del destino. */
    titulo: string
    /** La etiqueta mono de abajo (el rol del puesto). */
    eyebrow?: string
    /** El acento del MÓDULO — obligatorio: es lo que impide el hardcodeo. */
    acento: AcentoFicha
    /** Ranura para lo que el panel quiera meter (p. ej. una `Pildora` de estado). */
    children?: ReactNode
}

export function FichaAcceso({
    href,
    numero,
    icono: Icon,
    titulo,
    eyebrow,
    acento,
    children,
}: FichaAccesoProps) {
    const a = ACENTO[acento]
    return (
        <Link
            href={href}
            className={cn(
                'group relative flex min-h-[150px] flex-col gap-3.5 overflow-hidden rounded-lg border border-border bg-surface-2 p-[18px]',
                'touch-manipulation transition-all',
                // Hover sólido: toda la ficha se pinta con el acento del módulo.
                a.hover,
                'hover:-translate-y-0.5 hover:shadow-premium-md',
                // Se hunde al presionar: la tarjeta se comporta como botón.
                'active:translate-y-0 active:scale-[0.99]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                a.anillo
            )}
        >
            {/* Número fantasma — decorativo (el nombre lo lee el lector en el <h2>). */}
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute right-3.5 top-0.5 font-mono text-[68px] font-bold leading-none transition-colors group-hover:text-primary-fg/25',
                    a.fantasma
                )}
            >
                {numero}
            </span>

            <span
                className={cn(
                    'relative grid size-10 shrink-0 place-items-center rounded-md border transition-colors group-hover:border-primary-fg/30 group-hover:bg-primary-fg/20 group-hover:text-primary-fg',
                    a.caja
                )}
            >
                <Icon className="size-5" aria-hidden="true" />
            </span>

            <div className="relative mt-auto min-w-0">
                <h2 className="truncate font-display text-[13.5px] font-semibold tracking-wide text-foreground transition-colors group-hover:text-primary-fg">
                    {titulo}
                </h2>
                {eyebrow ? (
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-primary-fg/85">
                        {eyebrow}
                    </span>
                ) : null}
                {children ? <span className="mt-2.5 block">{children}</span> : null}
            </div>
        </Link>
    )
}
