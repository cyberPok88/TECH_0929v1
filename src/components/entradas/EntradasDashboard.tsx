'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRADAS DASHBOARD — aterrizaje del módulo (Guía 1.6 · remasterizado · Smart)
//
// ⭐ MEJORA 22 Sep 2026 (Fase 2 — fichas): el panel muestra el strip del flujo
// (01→05) y una ficha por etapa. Cambios de esta pasada:
//   · FUERA el par "Recibe / Entrega" (se veía cargado; el detalle vive en la guía
//     y en el flujo, no en la tarjeta) y FUERA la píldora de texto "Entrar →".
//   · Descripciones de una línea: la tarjeta informa, no explica.
//   · UNA sola señal de acción: el círculo con flecha que se enciende en hover.
//     La tarjeta entera es el enlace (Ley: no competir consigo misma).
//   · Densidad del proyecto: alturas duales (h-11 táctil / md:h-8 escritorio),
//     no una sola densidad impuesta.
//
// ⭐ MEJORA 22 Sep 2026 (Ficha I): nueva anatomía de la ficha de etapa —
//   · Número FANTASMA gigante (68px, tenue) arriba-derecha (sustituye al eyebrow "Paso NN").
//   · Icono en cuadro size-10 (estándar del kit) arriba.
//   · Abajo: nombre + rol (se retiran la descripción y la flecha).
//   · HOVER SÓLIDO: la ficha entera se pinta con el acento del MÓDULO y el texto pasa a
//     `primary-fg`.
//
// ⭐ MEJORA 22 Sep 2026 (acento UNIFICADO): las fichas usan `acc-entradas`, el MISMO azul
//   del strip y del sidebar. Antes tenían token propio (`--acc-entradas`, royal) y eso
//   dejaba DOS azules del mismo módulo en la misma pantalla (215 vs 252, Δ37°): el ojo lo leía
//   como incoherencia. El token propio se retiró (globals.css · tailwind.config ·
//   SPEC_TOKENS_ACENTOS) — un dominio, un acento.
//
// La lista de etapas sale del menu[] (ya recortado por permisos_navegacion);
// el ORDEN, el NOMBRE, el ROL y la DESCRIPCIÓN son estáticos (el flujo es fijo).
// ═══════════════════════════════════════════════════════════════════════════════

import { Fragment } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { usePageConfig } from '@/hooks/usePageConfig'
import { getIcon } from '@/config/icon-map'
import { useAuth, menuAplanado } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'

const RUTA = '/dashboard/entradas'

interface EtapaFlujo {
    href: string
    nombre: string
    orden: number
    rol: string
    desc: string
}

// Flujo fijo del ingreso de mercancía (FLUJO_01). El orden y el rol son contrato.
const ETAPAS_FLUJO: EtapaFlujo[] = [
    { href: '/dashboard/entradas/recepcion', nombre: 'Recepción', orden: 1, rol: 'Recepcionista', desc: 'Registrar la mercancía que llega.' },
    { href: '/dashboard/entradas/revision', nombre: 'Revisión técnica', orden: 2, rol: 'Técnico', desc: 'Revisar pieza por pieza y resolver el SKU.' },
    { href: '/dashboard/entradas/acondicionamiento', nombre: 'Acondicionamiento', orden: 3, rol: 'Acondicionador', desc: 'Dejar lo aprobado listo para el almacén.' },
    { href: '/dashboard/entradas/alta', nombre: 'Alta a inventario', orden: 4, rol: 'Almacenista', desc: 'Cotejar lo físico y dar ingreso al inventario.' },
    { href: '/dashboard/entradas/divergencias', nombre: 'Divergencias', orden: 5, rol: 'Administrador', desc: 'Resolver lo que no cuadró en el cotejo.' },
]

const ETAPA_POR_HREF: Record<string, EtapaFlujo> = Object.fromEntries(
    ETAPAS_FLUJO.map((e) => [e.href, e])
)

function numero(orden: number): string {
    return String(orden).padStart(2, '0')
}

export function EntradasDashboard() {
    const menu = useAuth(menuAplanado)
    const etapas = menu
        .filter((f) => f.href.startsWith('/dashboard/entradas/'))
        .sort((a, b) => a.orden_submodulo - b.orden_submodulo)

    const accesibles = new Set(etapas.map((e) => e.href))

    usePageConfig({ info: { title: 'Entradas', subtitle: 'Panel de ingreso de mercancía' }, path: RUTA })

    if (etapas.length === 0) {
        return (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface p-6">
                <p className="text-sm text-muted-foreground">Tu rol no tiene etapas de Entradas asignadas.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* ── Strip del flujo ─────────────────────────────────────────── */}
            {/* Alturas duales: 44px táctil en móvil, 32px de escritorio (§11). */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5">
                <span className="mr-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    Flujo
                </span>
                {ETAPAS_FLUJO.map((etapa, i) => {
                    const accesible = accesibles.has(etapa.href)
                    const chip = (
                        <>
                            <span className="font-mono text-[10px]">{numero(etapa.orden)}</span>
                            {etapa.nombre}
                        </>
                    )
                    return (
                        <Fragment key={etapa.href}>
                            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-border" aria-hidden="true" />}
                            {accesible ? (
                                <Link
                                    href={etapa.href}
                                    className={cn(
                                        'inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-[12px] font-semibold text-acc-entradas transition-colors md:h-8',
                                        'hover:bg-hover-background',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc-entradas'
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="size-1.5 rounded-full bg-acc-entradas"
                                    />
                                    {chip}
                                </Link>
                            ) : (
                                <span
                                    className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-[12px] font-semibold text-muted-foreground/60 md:h-8"
                                >
                                    {chip}
                                </span>
                            )}
                        </Fragment>
                    )
                })}
            </div>

            {/* ── Fichas de etapa ─────────────────────────────────────────── */}
            {/* Ficha I: número fantasma + icono + nombre/rol, con hover sólido en el
                acento del módulo (`acc-entradas`) — el mismo del strip. */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {etapas.map((e) => {
                    const etapa = ETAPA_POR_HREF[e.href]
                    const Icon = getIcon(e.icono_submodulo)
                    return (
                        <Link
                            key={e.href}
                            href={e.href}
                            className={cn(
                                'group relative flex min-h-[150px] flex-col gap-3.5 overflow-hidden rounded-lg border border-border bg-surface-2 p-[18px]',
                                'touch-manipulation transition-all',
                                // Hover sólido: toda la ficha se pinta con el acento de la ficha.
                                'hover:-translate-y-0.5 hover:border-acc-entradas hover:bg-acc-entradas hover:shadow-premium-md',
                                // Se hunde al presionar: la tarjeta se comporta como botón.
                                'active:translate-y-0 active:scale-[0.99]',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc-entradas focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                            )}
                        >
                            {/* Número fantasma — decorativo (el nombre lo lee el lector en el <h2>). */}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute right-3.5 top-0.5 font-mono text-[68px] font-bold leading-none text-acc-entradas/15 transition-colors group-hover:text-primary-fg/25"
                            >
                                {numero(etapa.orden)}
                            </span>

                            <span className="relative grid size-10 shrink-0 place-items-center rounded-md border border-acc-entradas/30 bg-acc-entradas/10 text-acc-entradas transition-colors group-hover:border-primary-fg/30 group-hover:bg-primary-fg/20 group-hover:text-primary-fg">
                                <Icon className="size-5" aria-hidden="true" />
                            </span>

                            <div className="relative mt-auto min-w-0">
                                <h2 className="truncate font-display text-[13.5px] font-semibold tracking-wide text-foreground transition-colors group-hover:text-primary-fg">
                                    {e.nombre_submodulo}
                                </h2>
                                <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-primary-fg/85">
                                    {etapa.rol}
                                </span>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
